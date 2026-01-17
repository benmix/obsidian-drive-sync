import Dexie, { type Table } from "dexie";
import type { SyncEntryTable, SyncJobTable, SyncLog, SyncMeta } from "./sync-schema";

export const SYNC_STATE_DB_NAME = "protondrive-sync";
export const SYNC_STATE_DB_VERSION = 1;

export const SYNC_STATE_SCHEMA = {
	entries: "relPath, remoteId, remoteRev, syncedRemoteRev, tombstone",
	jobs: "id, op, path, priority, nextRunAt",
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
		this.version(SYNC_STATE_DB_VERSION).stores(SYNC_STATE_SCHEMA);
	}
}

export const syncStateDb = new SyncStateDb();
