import type { LocalFileSystem, RemoteFileSystem } from "./types";
import type { SyncEntry, SyncJob } from "../data/sync-schema";
import { SyncIndexStore } from "./index-store";
import type { SyncState } from "./index-store";
import { SyncJobQueue } from "./job-queue";
import { reconcileSnapshot } from "./reconciler";
import { executeJobs, type ExecuteResult } from "./executor";
import type { StateStore } from "./state-store";
import { backoffMs, normalizePath, now } from "./utils";
import { getBuiltInExcludeRules, type ExcludeRule } from "./exclude";
import { INTERNAL_MAX_CONCURRENT_JOBS, INTERNAL_MAX_RETRY_ATTEMPTS } from "../internal-config";

type SyncEngineOptions = {
	conflictStrategy?: "local-wins" | "remote-wins" | "manual";
	onAuthError?: (message: string) => void;
};

const MAX_CONCURRENT_JOBS_CAP = 4;

export class SyncEngine {
	private localFs: LocalFileSystem;
	private remoteFs: RemoteFileSystem;
	private stateStore: StateStore;
	private options: SyncEngineOptions;
	private excludeRules: ExcludeRule[];
	private authPaused = false;
	private maxRetryAttempts: number;
	private index: SyncIndexStore;
	private queue: SyncJobQueue;

	constructor(
		localFs: LocalFileSystem,
		remoteFs: RemoteFileSystem,
		stateStore: StateStore,
		options: SyncEngineOptions = {},
	) {
		this.localFs = localFs;
		this.remoteFs = remoteFs;
		this.stateStore = stateStore;
		this.options = options;
		this.excludeRules = getBuiltInExcludeRules();
		this.index = new SyncIndexStore();
		this.queue = new SyncJobQueue();
		this.maxRetryAttempts = INTERNAL_MAX_RETRY_ATTEMPTS;
	}

	async load(): Promise<void> {
		const state = await this.stateStore.load();
		this.index = new SyncIndexStore(state);
		const cleaned = this.cleanupJobs(state.jobs, state.entries);
		this.queue = new SyncJobQueue(this.recoverJobs(cleaned));
	}

	async save(overrides?: Partial<SyncState>): Promise<void> {
		const base = this.index.toJSON();
		if (overrides && ("lastError" in overrides || "lastErrorAt" in overrides)) {
			this.index.setLastError(overrides.lastError, overrides.lastErrorAt);
		}
		if (overrides && "remoteEventCursor" in overrides) {
			this.index.setRemoteEventCursor(overrides.remoteEventCursor);
		}
		const state: SyncState = {
			entries: base.entries,
			jobs: this.queue.list(),
			lastSyncAt: base.lastSyncAt,
			lastError: overrides?.lastError ?? base.lastError,
			lastErrorAt: overrides?.lastErrorAt ?? base.lastErrorAt,
			remoteEventCursor: overrides?.remoteEventCursor ?? base.remoteEventCursor,
			logs: base.logs,
		};
		await this.stateStore.save(state);
	}

	async plan(): Promise<{ jobsPlanned: number; entries: number }> {
		const result = await reconcileSnapshot(this.localFs, this.remoteFs, this.index.toJSON(), {
			conflictStrategy: this.options.conflictStrategy,
		});
		for (const entry of result.snapshot) {
			this.index.setEntry(entry);
		}
		this.queue.enqueueMany(this.mergeMoveJobs(this.filterJobs(result.jobs)));
		await this.save();
		return {
			jobsPlanned: this.queue.list().length,
			entries: this.index.listEntries().length,
		};
	}

	async runOnce(): Promise<{ jobsExecuted: number; entriesUpdated: number }> {
		if (this.authPaused) {
			return { jobsExecuted: 0, entriesUpdated: 0 };
		}
		const jobs = this.queue.list();
		const queueDepth = jobs.length;
		const jobCounts = countJobStates(jobs);
		if (!this.authPaused) {
			this.unblockAuthJobs(jobs);
		}
		const startedAt = now();
		const nowTs = now();
		const dueJobs = jobs.filter((job) => job.status !== "blocked" && job.nextRunAt <= nowTs);
		const pendingJobs = jobs.filter((job) => job.nextRunAt > nowTs);
		if (dueJobs.length === 0) {
			return { jobsExecuted: 0, entriesUpdated: 0 };
		}
		let jobsExecuted = 0;
		const entries: SyncEntry[] = [];
		let uploadBytes = 0;
		let downloadBytes = 0;
		const retryJobs: SyncJob[] = [];

		const concurrency = Math.max(
			1,
			Math.min(INTERNAL_MAX_CONCURRENT_JOBS, MAX_CONCURRENT_JOBS_CAP),
		);
		const buckets = this.bucketByPath(dueJobs);
		for (const batch of buckets) {
			const active = batch.slice(0, concurrency);
			const results = await Promise.all(active.map((job) => this.executeJob(job, retryJobs)));
			for (const result of results) {
				if (!result) {
					continue;
				}
				entries.push(...result.entries);
				jobsExecuted += result.jobsExecuted;
				uploadBytes += result.uploadBytes;
				downloadBytes += result.downloadBytes;
			}
			if (this.authPaused) {
				this.index.addLog("Authentication required. Sync paused.", "auth");
				break;
			}
			for (const job of batch.slice(concurrency)) {
				retryJobs.push({
					...job,
					attempt: job.attempt + 1,
					nextRunAt: now() + backoffMs(job.attempt + 1),
					reason: "path-queue",
					status: "pending",
					lockedAt: undefined,
					lastError: undefined,
				});
			}
		}

		for (const entry of entries) {
			this.index.setEntry(entry);
		}

		this.queue.clear();
		if (pendingJobs.length > 0) {
			this.queue.enqueueMany(pendingJobs);
		}
		if (retryJobs.length > 0) {
			this.queue.enqueueMany(retryJobs);
		}

		this.index.setLastSyncAt(now());

		const durationMs = Math.max(0, now() - startedAt);
		const failures = retryJobs.length;
		this.index.updateRuntimeMetrics({
			lastRunAt: now(),
			lastRunDurationMs: durationMs,
			lastRunJobsExecuted: jobsExecuted,
			lastRunEntriesUpdated: entries.length,
			lastRunFailures: failures,
			lastRunUploadBytes: uploadBytes,
			lastRunDownloadBytes: downloadBytes,
			peakQueueDepth: queueDepth,
			peakPendingJobs: jobCounts.pending,
			peakBlockedJobs: jobCounts.blocked,
		});

		if (retryJobs.length > 0) {
			await this.save({
				lastError: this.authPaused
					? "Authentication required. Sync paused."
					: "Some jobs failed. Retrying.",
				lastErrorAt: now(),
			});
		} else {
			await this.save({ lastError: undefined, lastErrorAt: undefined });
		}

		return { jobsExecuted, entriesUpdated: entries.length };
	}

	enqueue(job: SyncJob): void {
		if (this.isExcluded(job.path)) {
			return;
		}
		this.queue.enqueue(job);
	}

	applyEntries(entries: SyncEntry[]): void {
		for (const entry of entries) {
			if (this.isExcluded(entry.relPath)) {
				continue;
			}
			this.index.setEntry(entry);
		}
	}

	removeEntries(paths: string[]): void {
		for (const path of paths) {
			this.index.removeEntry(path);
		}
	}

	rewritePaths(prefixes: Array<{ from: string; to: string }>): void {
		if (prefixes.length === 0) {
			return;
		}
		const entries = this.index.listEntries();
		for (const entry of entries) {
			for (const prefix of prefixes) {
				const from = normalizePath(prefix.from);
				const to = normalizePath(prefix.to);
				if (entry.relPath === from || entry.relPath.startsWith(`${from}/`)) {
					const suffix = entry.relPath.slice(from.length);
					const nextPath = `${to}${suffix}`;
					this.index.removeEntry(entry.relPath);
					this.index.setEntry({ ...entry, relPath: nextPath });
				}
			}
		}
	}

	listJobs(): SyncJob[] {
		return this.queue.list();
	}

	async rebuildIndex(): Promise<void> {
		this.index = new SyncIndexStore();
		this.queue = new SyncJobQueue();
		await this.plan();
	}

	private isExcluded(path: string): boolean {
		if (this.excludeRules.length === 0) {
			return false;
		}
		const normalized = normalizePath(path);
		return this.excludeRules.some((rule) => rule.regex.test(normalized));
	}

	private filterJobs(jobs: SyncJob[]): SyncJob[] {
		return jobs.filter((job) => !this.isExcluded(job.path));
	}

	private mergeMoveJobs(jobs: SyncJob[]): SyncJob[] {
		const byRemoteId = new Map<string, { move: SyncJob; uploads: SyncJob[] }>();
		const remaining: SyncJob[] = [];

		for (const job of jobs) {
			if (job.op === "move-remote" && job.remoteId) {
				byRemoteId.set(job.remoteId, { move: job, uploads: [] });
				continue;
			}
			if (job.op === "upload" && job.remoteId) {
				const existing = byRemoteId.get(job.remoteId);
				if (existing) {
					existing.uploads.push(job);
					continue;
				}
			}
			remaining.push(job);
		}

		for (const { move, uploads } of byRemoteId.values()) {
			if (uploads.length === 0) {
				remaining.push(move);
				continue;
			}
			const bestUpload = uploads.sort(
				(a, b) => b.priority - a.priority || a.nextRunAt - b.nextRunAt,
			)[0];
			if (bestUpload) {
				remaining.push(move, bestUpload);
			} else {
				remaining.push(move);
			}
		}

		return remaining;
	}

	private bucketByPath(jobs: SyncJob[]): SyncJob[][] {
		const buckets = new Map<string, SyncJob[]>();
		for (const job of jobs) {
			const key = normalizePath(job.path);
			const list = buckets.get(key) ?? [];
			list.push(job);
			buckets.set(key, list);
		}
		return Array.from(buckets.values());
	}

	private async executeJob(job: SyncJob, retryJobs: SyncJob[]): Promise<ExecuteResult | null> {
		try {
			const activeJob: SyncJob = {
				...job,
				status: "processing",
				lockedAt: now(),
				lastError: undefined,
			};
			const result = await executeJobs(this.localFs, this.remoteFs, [activeJob]);
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : "retry";
			if (isNotFoundError(message)) {
				this.index.addLog(`Job blocked: ${job.id} (${message})`, "retry");
				retryJobs.push({
					...job,
					status: "blocked",
					lockedAt: undefined,
					lastError: message,
				});
				return null;
			}
			if (isAuthError(message)) {
				this.authPaused = true;
				this.options.onAuthError?.(message);
				this.index.addLog(message, "auth");
				retryJobs.push({
					...job,
					status: "blocked",
					lockedAt: undefined,
					lastError: message,
				});
				return null;
			}
			if (job.attempt + 1 >= this.maxRetryAttempts) {
				this.index.addLog(
					`Job failed after ${this.maxRetryAttempts} attempts: ${job.id}`,
					"retry",
				);
				retryJobs.push({
					...job,
					status: "blocked",
					lockedAt: undefined,
					lastError: message,
				});
				return null;
			}
			const nextAttempt = job.attempt + 1;
			const delay = backoffForError(message, nextAttempt);
			retryJobs.push({
				...job,
				attempt: nextAttempt,
				nextRunAt: now() + delay,
				reason: message,
				status: "pending",
				lockedAt: undefined,
				lastError: message,
			});
			return null;
		}
	}

	private recoverJobs(jobs: SyncJob[]): SyncJob[] {
		const nowTs = now();
		return jobs.map((job) => {
			if (job.status === "processing") {
				return {
					...job,
					status: "pending",
					lockedAt: undefined,
					nextRunAt: Math.min(job.nextRunAt, nowTs),
				};
			}
			return {
				...job,
				status: job.status ?? "pending",
				lockedAt: undefined,
			};
		});
	}

	private unblockAuthJobs(jobs: SyncJob[]): void {
		for (const job of jobs) {
			if (job.status !== "blocked" || !job.lastError) {
				continue;
			}
			if (isAuthError(job.lastError)) {
				job.status = "pending";
				job.lockedAt = undefined;
			}
		}
	}

	private cleanupJobs(jobs: SyncJob[], entries: Record<string, SyncEntry>): SyncJob[] {
		const cleaned: SyncJob[] = [];
		for (const job of jobs) {
			if (!this.isJobValid(job)) {
				this.index.addLog(`Dropped invalid job: ${job.id}`, "cleanup");
				continue;
			}
			const entry = entries[job.path];
			if (entry?.tombstone && job.op === "upload") {
				this.index.addLog(`Dropped upload for tombstone: ${job.id}`, "cleanup");
				continue;
			}
			cleaned.push(job);
		}
		return cleaned;
	}

	private isJobValid(job: SyncJob): boolean {
		if (job.op === "download" && !job.remoteId) {
			return false;
		}
		if (job.op === "delete-remote" && !job.remoteId) {
			return false;
		}
		if (job.op === "move-local" && (!job.fromPath || !job.toPath)) {
			return false;
		}
		if (job.op === "move-remote" && (!job.remoteId || !job.toPath)) {
			return false;
		}
		return true;
	}
}

function countJobStates(jobs: SyncJob[]): {
	pending: number;
	processing: number;
	blocked: number;
} {
	const counts = { pending: 0, processing: 0, blocked: 0 };
	for (const job of jobs) {
		if (job.status === "processing") {
			counts.processing += 1;
		} else if (job.status === "blocked") {
			counts.blocked += 1;
		} else {
			counts.pending += 1;
		}
	}
	return counts;
}
function isAuthError(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		normalized.includes("auth") ||
		normalized.includes("token") ||
		normalized.includes("unauthorized") ||
		normalized.includes("forbidden") ||
		normalized.includes("login")
	);
}

function isNotFoundError(message: string): boolean {
	const normalized = message.toLowerCase();
	return normalized.includes("not found") || normalized.includes("404");
}

function backoffForError(message: string, attempt: number): number {
	const normalized = message.toLowerCase();
	if (isNotFoundError(normalized)) {
		return Math.min(10000 * attempt, 60000);
	}
	if (
		normalized.includes("rate") ||
		normalized.includes("throttle") ||
		normalized.includes("too many")
	) {
		return Math.min(30000 * attempt, 300000);
	}
	if (
		normalized.includes("network") ||
		normalized.includes("timeout") ||
		normalized.includes("temporar") ||
		normalized.includes("503") ||
		normalized.includes("500")
	) {
		return backoffMs(attempt);
	}
	return Math.min(5000 * attempt, 60000);
}
