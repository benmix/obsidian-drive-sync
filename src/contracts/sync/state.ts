import type { DriveSyncErrorCode, ErrorCategory } from "../data/error-types";
import type { SyncEntry, SyncJob, SyncLog } from "../data/sync-schema";

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
	lastErrorAt?: number;
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorCategory?: ErrorCategory;
	lastErrorRetryable?: boolean;
	remoteEventCursor?: string;
	logs?: SyncLog[];
	runtimeMetrics?: SyncRuntimeMetrics;
};
