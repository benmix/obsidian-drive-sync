import type { LocalFileSystem, RemoteFileSystem } from "./types";
import type { SyncEntry, SyncJob, SyncState } from "./index-types";
import { SyncIndexStore } from "./index-store";
import { SyncJobQueue } from "./job-queue";
import { reconcileSnapshot } from "./reconciler";
import { executeJobs } from "./executor";
import type { StateStore } from "./state-store";
import { backoffMs, now } from "./utils";

export class SyncEngine {
	private localFs: LocalFileSystem;
	private remoteFs: RemoteFileSystem;
	private stateStore: StateStore;
	private index: SyncIndexStore;
	private queue: SyncJobQueue;

	constructor(localFs: LocalFileSystem, remoteFs: RemoteFileSystem, stateStore: StateStore) {
		this.localFs = localFs;
		this.remoteFs = remoteFs;
		this.stateStore = stateStore;
		this.index = new SyncIndexStore();
		this.queue = new SyncJobQueue();
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
		const state: SyncState = {
			entries: base.entries,
			jobs: this.queue.list(),
			lastSyncAt: base.lastSyncAt,
			lastError: overrides?.lastError ?? base.lastError,
			lastErrorAt: overrides?.lastErrorAt ?? base.lastErrorAt,
		};
		await this.stateStore.save(state);
	}

	async plan(): Promise<{ jobsPlanned: number; entries: number }> {
		const result = await reconcileSnapshot(this.localFs, this.remoteFs, this.index.toJSON());
		for (const entry of result.snapshot) {
			this.index.setEntry(entry);
		}
		this.queue.enqueueMany(result.jobs);
		await this.save();
		return {
			jobsPlanned: this.queue.list().length,
			entries: this.index.listEntries().length,
		};
	}

	async runOnce(): Promise<{ jobsExecuted: number; entriesUpdated: number }> {
		const jobs = this.queue.list();
		if (jobs.length === 0) {
			return { jobsExecuted: 0, entriesUpdated: 0 };
		}
		let jobsExecuted = 0;
		const entries: SyncEntry[] = [];
		const retryJobs: SyncJob[] = [];

		for (const job of jobs) {
			try {
				const result = await executeJobs(this.localFs, this.remoteFs, [job]);

				entries.push(...result.entries);
				jobsExecuted += result.jobsExecuted;
			} catch (error) {
				const nextAttempt = job.attempt + 1;
				retryJobs.push({
					...job,
					attempt: nextAttempt,
					nextRunAt: now() + backoffMs(nextAttempt),
					reason: error instanceof Error ? error.message : "retry",
				});
			}
		}

		for (const entry of entries) {
			this.index.setEntry(entry);
		}

		this.queue.clear();
		if (retryJobs.length > 0) {
			this.queue.enqueueMany(retryJobs);
		}

		this.index.setLastSyncAt(now());

		if (retryJobs.length > 0) {
			await this.save({
				lastError: "Some jobs failed. Retrying.",
				lastErrorAt: now(),
			});
		} else {
			await this.save({ lastError: undefined, lastErrorAt: undefined });
		}

		return { jobsExecuted, entriesUpdated: entries.length };
	}

	enqueue(job: SyncJob): void {
		this.queue.enqueue(job);
	}

	applyEntries(entries: SyncEntry[]): void {
		for (const entry of entries) {
			this.index.setEntry(entry);
		}
	}

	removeEntries(paths: string[]): void {
		for (const path of paths) {
			this.index.removeEntry(path);
		}
	}

	listJobs(): SyncJob[] {
		return this.queue.list();
	}
}
