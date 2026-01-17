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
	conflict?: {
		localMtimeMs?: number;
		remoteRev?: string;
		remoteId?: string;
		detectedAt: number;
	};
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
	remoteRev?: string;
	priority: number;
	attempt: number;
	nextRunAt: number;
	reason?: string;
};

export type SyncMeta = {
	key: "lastSyncAt" | "lastError" | "lastErrorAt" | "remoteEventCursor";
	value: number | string | undefined;
};

export type SyncLog = {
	id?: number;
	at: string;
	message: string;
	context?: string;
};

export type SyncEntryTable = SyncEntry;
export type SyncJobTable = SyncJob;
