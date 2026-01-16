export type EntryType = "file" | "folder";

export type SyncEntry = {
	relPath: string;
	type: EntryType;
	localMtimeMs?: number;
	localSize?: number;
	localHash?: string;
	remoteId?: string;
	remoteRev?: string;
	syncedLocalHash?: string;
	syncedRemoteRev?: string;
	remoteMtimeMs?: number;
	remoteSize?: number;
	tombstone?: boolean;
	lastSyncAt?: number;
};

export type JobOp =
	| "upload"
	| "download"
	| "delete-local"
	| "delete-remote"
	| "move-local"
	| "move-remote";

export type SyncJob = {
	id: string;
	op: JobOp;
	path: string;
	fromPath?: string;
	toPath?: string;
	remoteId?: string;
	priority: number;
	attempt: number;
	nextRunAt: number;
	reason?: string;
};

export type SyncState = {
	entries: Record<string, SyncEntry>;
	jobs: SyncJob[];
	lastSyncAt?: number;
	lastError?: string;
	lastErrorAt?: number;
};

export const DEFAULT_SYNC_STATE: SyncState = {
	entries: {},
	jobs: [],
};
