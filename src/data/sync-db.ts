import Dexie, { type Table } from "dexie";

import type {
	SyncEntryTable,
	SyncJobTable,
	SyncLog,
	SyncMeta,
} from "../contracts/data/sync-schema";

export const SYNC_STATE_DB_NAME = "drive-sync-state";
export const SYNC_STATE_DB_VERSION = 2;

export const SYNC_STATE_SCHEMA = {
	entries: "relPath, remoteId, remoteRev, syncedRemoteRev, tombstone",
	jobs: "id, op, path, priority, nextRunAt, status",
	meta: "key",
	logs: "++id, at",
} as const;

class SyncStateDb extends Dexie {
	entries!: Table<SyncEntryTable, string>;
	jobs!: Table<SyncJobTable, string>;
	meta!: Table<SyncMeta, string>;
	logs!: Table<SyncLog, number>;

	constructor() {
		super(SYNC_STATE_DB_NAME);
		this.version(1).stores({
			entries: "relPath, remoteId, remoteRev, syncedRemoteRev, tombstone",
			jobs: "id, op, path, priority, nextRunAt",
			meta: "key",
			logs: "++id, at",
		});
		this.version(SYNC_STATE_DB_VERSION).stores(SYNC_STATE_SCHEMA);
	}
}

export const syncStateDb = new SyncStateDb();

let syncStateDbReadyPromise: Promise<void> | null = null;

export function ensureSyncStateDbReady(): Promise<void> {
	if (!syncStateDbReadyPromise) {
		syncStateDbReadyPromise = Promise.resolve();
	}
	return syncStateDbReadyPromise;
}
