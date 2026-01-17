import type { LocalFileSystem, RemoteFileSystem } from "./types";
import type { SyncEntry, SyncJob } from "../data/sync-schema";
import { SyncIndexStore, SyncState } from "./index-store";
import { SyncJobQueue } from "./job-queue";
import { reconcileSnapshot } from "./reconciler";
import { executeJobs, type ExecuteResult } from "./executor";
import type { StateStore } from "./state-store";
import { backoffMs, normalizePath, now } from "./utils";
import { compileExcludeRules, type ExcludeRule } from "./exclude";

type SyncEngineOptions = {
	maxConcurrentJobs?: number;
	excludePatterns?: string;
	conflictStrategy?: "local-wins" | "remote-wins" | "manual";
	onAuthError?: (message: string) => void;
	maxRetryAttempts?: number;
};

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
		this.excludeRules = compileExcludeRules(options.excludePatterns ?? "");
		this.index = new SyncIndexStore();
		this.queue = new SyncJobQueue();
		this.maxRetryAttempts = options.maxRetryAttempts ?? 5;
	}

	async load(): Promise<void> {
		const state = await this.stateStore.load();
		this.index = new SyncIndexStore(state);
		this.queue = new SyncJobQueue(state.jobs);
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
		this.queue.enqueueMany(this.filterJobs(result.jobs));
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
		const nowTs = now();
		const dueJobs = jobs.filter((job) => job.nextRunAt <= nowTs);
		const pendingJobs = jobs.filter((job) => job.nextRunAt > nowTs);
		if (dueJobs.length === 0) {
			return { jobsExecuted: 0, entriesUpdated: 0 };
		}
		let jobsExecuted = 0;
		const entries: SyncEntry[] = [];
		const retryJobs: SyncJob[] = [];

		const concurrency = Math.max(1, Math.min(this.options.maxConcurrentJobs ?? 2, 4));
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
			return await executeJobs(this.localFs, this.remoteFs, [job]);
		} catch (error) {
			const message = error instanceof Error ? error.message : "retry";
			if (isAuthError(message)) {
				this.authPaused = true;
				this.options.onAuthError?.(message);
				this.index.addLog(message, "auth");
				return null;
			}
			if (job.attempt + 1 >= this.maxRetryAttempts) {
				this.index.addLog(
					`Job failed after ${this.maxRetryAttempts} attempts: ${job.id}`,
					"retry",
				);
				return null;
			}
			const nextAttempt = job.attempt + 1;
			const delay = backoffForError(message, nextAttempt);
			retryJobs.push({
				...job,
				attempt: nextAttempt,
				nextRunAt: now() + delay,
				reason: message,
			});
			return null;
		}
	}
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

function backoffForError(message: string, attempt: number): number {
	const normalized = message.toLowerCase();
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
