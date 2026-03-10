import type { EntryType } from "../filesystem/entry";

import type { DriveSyncErrorCode, ErrorCategory } from "./error-types";

export type SyncEntry = {
	relPath: string;
	type: EntryType;
	localMtimeMs?: number;
	localSize?: number;
	localHash?: string;
	remoteId?: string;
	remoteRev?: string;
	remoteParentId?: string;
	syncedLocalHash?: string;
	syncedRemoteRev?: string;
	remoteMtimeMs?: number;
	remoteSize?: number;
	remoteMissingCount?: number;
	remoteMissingSinceMs?: number;
	tombstone?: boolean;
	conflict?: {
		localMtimeMs?: number;
		remoteRev?: string;
		remoteId?: string;
		detectedAt: number;
	};
	conflictPending?: boolean;
	lastSyncAt?: number;
};

export type JobOp =
	| "upload"
	| "download"
	| "copy-local"
	| "delete-local"
	| "delete-remote"
	| "move-local"
	| "move-remote"
	| "create-local-folder"
	| "create-remote-folder";

export type SyncJob = {
	id: string;
	op: JobOp;
	path: string;
	entryType?: EntryType;
	fromPath?: string;
	toPath?: string;
	remoteId?: string;
	remoteRev?: string;
	priority: number;
	attempt: number;
	nextRunAt: number;
	reason?: string;
	status?: "pending" | "processing" | "blocked";
	lockedAt?: number;
	lastErrorCode?: DriveSyncErrorCode;
	lastErrorRetryable?: boolean;
	lastErrorAt?: number;
};

export type SyncMeta = {
	key:
		| "lastSyncAt"
		| "lastErrorAt"
		| "lastErrorCode"
		| "lastErrorCategory"
		| "lastErrorRetryable"
		| "remoteEventCursor"
		| "runtimeMetrics";
	value: number | string | boolean | undefined;
};

export type SyncLog = {
	id?: number;
	at: string;
	message: string;
	context?: string;
	code?: DriveSyncErrorCode;
	category?: ErrorCategory;
	retryable?: boolean;
	path?: string;
	jobId?: string;
	jobOp?: JobOp;
	provider?: string;
	details?: Record<string, unknown>;
};

export type SyncEntryTable = SyncEntry;
export type SyncJobTable = SyncJob;
