export type EntryType = "file" | "folder";

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
	tombstone?: boolean;
	lastSyncAt?: number;
};

export type JobOp =
	| "upload"
	| "download"
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
