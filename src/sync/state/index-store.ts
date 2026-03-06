import type { SyncEntry, SyncJob } from "../../data/sync-schema";

export type SyncRuntimeMetrics = {
	lastRunAt?: number;
	lastRunDurationMs?: number;
	lastRunJobsExecuted?: number;
	lastRunEntriesUpdated?: number;
	lastRunFailures?: number;
	lastRunUploadBytes?: number;
	lastRunDownloadBytes?: number;
	lastRunThroughputBytesPerSec?: number;
	totalRuns?: number;
	totalFailures?: number;
	totalUploadBytes?: number;
	totalDownloadBytes?: number;
	peakQueueDepth?: number;
	peakPendingJobs?: number;
	peakBlockedJobs?: number;
};

export type SyncState = {
	entries: Record<string, SyncEntry>;
	jobs: SyncJob[];
	lastSyncAt?: number;
	lastError?: string;
	lastErrorAt?: number;
	remoteEventCursor?: string;
	logs?: Array<{ at: string; message: string; context?: string }>;
	runtimeMetrics?: SyncRuntimeMetrics;
};

export const DEFAULT_SYNC_STATE: SyncState = {
	entries: {},
	jobs: [],
	logs: [],
	runtimeMetrics: {},
};

export class SyncIndexStore {
	private state: SyncState;

	constructor(initial?: SyncState) {
		this.state = initial ?? {
			entries: {},
			jobs: [],
			logs: [],
			runtimeMetrics: {},
		};
	}

	getEntry(path: string): SyncEntry | undefined {
		return this.state.entries[path];
	}

	setEntry(entry: SyncEntry): void {
		const prior = this.state.entries[entry.relPath];
		const merged: SyncEntry = {
			...(prior ?? {}),
			...entry,
		};
		const hasRemoteMissingCount = Object.prototype.hasOwnProperty.call(
			entry,
			"remoteMissingCount",
		);
		const hasRemoteMissingSinceMs = Object.prototype.hasOwnProperty.call(
			entry,
			"remoteMissingSinceMs",
		);
		// Treat any non-tombstone write as the path becoming live again.
		if (entry.tombstone !== true) {
			merged.tombstone = undefined;
		}
		// By default, seeing a live remote node or writing a tombstone clears stale
		// remote-missing tracking unless the caller explicitly updates the counter.
		if (
			!hasRemoteMissingCount &&
			!hasRemoteMissingSinceMs &&
			(entry.remoteId !== undefined || entry.tombstone === true)
		) {
			merged.remoteMissingCount = undefined;
			merged.remoteMissingSinceMs = undefined;
		}
		this.state.entries[entry.relPath] = merged;
	}

	removeEntry(path: string): void {
		delete this.state.entries[path];
	}

	listEntries(): SyncEntry[] {
		return Object.values(this.state.entries);
	}

	addJob(job: SyncJob): void {
		this.state.jobs.push(job);
	}

	listJobs(): SyncJob[] {
		return [...this.state.jobs];
	}

	clearJobs(): void {
		this.state.jobs = [];
	}

	removeJob(jobId: string): void {
		this.state.jobs = this.state.jobs.filter((job) => job.id !== jobId);
	}

	toJSON(): SyncState {
		return {
			entries: { ...this.state.entries },
			jobs: [...this.state.jobs],
			lastSyncAt: this.state.lastSyncAt,
			lastError: this.state.lastError,
			lastErrorAt: this.state.lastErrorAt,
			remoteEventCursor: this.state.remoteEventCursor,
			logs: [...(this.state.logs ?? [])],
			runtimeMetrics: this.state.runtimeMetrics
				? { ...this.state.runtimeMetrics }
				: undefined,
		};
	}

	setLastSyncAt(timestamp: number): void {
		this.state.lastSyncAt = timestamp;
	}

	setLastError(lastError?: string, lastErrorAt?: number): void {
		this.state.lastError = lastError;
		this.state.lastErrorAt = lastErrorAt;
	}

	setRemoteEventCursor(cursor?: string): void {
		this.state.remoteEventCursor = cursor;
	}

	updateRuntimeMetrics(
		update: Omit<
			SyncRuntimeMetrics,
			| "totalRuns"
			| "totalFailures"
			| "totalUploadBytes"
			| "totalDownloadBytes"
			| "peakQueueDepth"
			| "peakPendingJobs"
			| "peakBlockedJobs"
		> & {
			peakQueueDepth?: number;
			peakPendingJobs?: number;
			peakBlockedJobs?: number;
		},
	): void {
		const current = this.state.runtimeMetrics ?? {};
		const lastRunBytes = (update.lastRunUploadBytes ?? 0) + (update.lastRunDownloadBytes ?? 0);
		const throughput =
			update.lastRunDurationMs && update.lastRunDurationMs > 0
				? Math.round((lastRunBytes * 1000) / update.lastRunDurationMs)
				: 0;
		this.state.runtimeMetrics = {
			...current,
			...update,
			lastRunThroughputBytesPerSec: throughput,
			totalRuns: (current.totalRuns ?? 0) + 1,
			totalFailures: (current.totalFailures ?? 0) + (update.lastRunFailures ?? 0),
			totalUploadBytes: (current.totalUploadBytes ?? 0) + (update.lastRunUploadBytes ?? 0),
			totalDownloadBytes:
				(current.totalDownloadBytes ?? 0) + (update.lastRunDownloadBytes ?? 0),
			peakQueueDepth: Math.max(current.peakQueueDepth ?? 0, update.peakQueueDepth ?? 0),
			peakPendingJobs: Math.max(current.peakPendingJobs ?? 0, update.peakPendingJobs ?? 0),
			peakBlockedJobs: Math.max(current.peakBlockedJobs ?? 0, update.peakBlockedJobs ?? 0),
		};
	}

	addLog(message: string, context?: string): void {
		const entry = {
			at: new Date().toISOString(),
			message,
			context,
		};
		this.state.logs = [...(this.state.logs ?? []), entry].slice(-200);
	}
}
