import type { SyncEntry, SyncJob } from "../data/sync-schema";

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
