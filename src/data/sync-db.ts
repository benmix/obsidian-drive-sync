import Dexie, { type Table } from "dexie";
import type { SyncEntryTable, SyncJobTable, SyncLog, SyncMeta } from "./sync-schema";

export const SYNC_STATE_DB_NAME = "drive-sync-state";
export const SYNC_STATE_DB_VERSION = 2;
const LEGACY_SYNC_STATE_DB_NAME = "protondrive-sync";

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
		syncStateDbReadyPromise = migrateLegacySyncStateDbIfNeeded();
	}
	return syncStateDbReadyPromise;
}

async function migrateLegacySyncStateDbIfNeeded(): Promise<void> {
	if (!(await Dexie.exists(LEGACY_SYNC_STATE_DB_NAME))) {
		return;
	}
	if (await hasAnyData(syncStateDb)) {
		return;
	}

	const legacyDb = createLegacySyncStateDb();
	try {
		await legacyDb.open();
		if (!(await hasAnyData(legacyDb))) {
			return;
		}
		const [entries, jobs, meta, logs] = await Promise.all([
			legacyDb.entries.toArray(),
			legacyDb.jobs.toArray(),
			legacyDb.meta.toArray(),
			legacyDb.logs.toArray(),
		]);
		await syncStateDb.transaction(
			"rw",
			syncStateDb.entries,
			syncStateDb.jobs,
			syncStateDb.meta,
			syncStateDb.logs,
			async () => {
				if (entries.length > 0) {
					await syncStateDb.entries.bulkPut(entries);
				}
				if (jobs.length > 0) {
					await syncStateDb.jobs.bulkPut(jobs);
				}
				if (meta.length > 0) {
					await syncStateDb.meta.bulkPut(meta);
				}
				if (logs.length > 0) {
					await syncStateDb.logs.bulkPut(logs);
				}
			},
		);
	} catch (error) {
		console.warn("Failed to migrate legacy sync state database.", error);
	} finally {
		legacyDb.close();
	}
}

function createLegacySyncStateDb(): Dexie & {
	entries: Table<SyncEntryTable, string>;
	jobs: Table<SyncJobTable, string>;
	meta: Table<SyncMeta, string>;
	logs: Table<SyncLog, number>;
} {
	const legacyDb = new Dexie(LEGACY_SYNC_STATE_DB_NAME) as Dexie & {
		entries: Table<SyncEntryTable, string>;
		jobs: Table<SyncJobTable, string>;
		meta: Table<SyncMeta, string>;
		logs: Table<SyncLog, number>;
	};
	legacyDb.version(1).stores({
		entries: "relPath, remoteId, remoteRev, syncedRemoteRev, tombstone",
		jobs: "id, op, path, priority, nextRunAt",
		meta: "key",
		logs: "++id, at",
	});
	legacyDb.version(SYNC_STATE_DB_VERSION).stores(SYNC_STATE_SCHEMA);
	return legacyDb;
}

async function hasAnyData(db: {
	entries: Table<SyncEntryTable, string>;
	jobs: Table<SyncJobTable, string>;
	meta: Table<SyncMeta, string>;
	logs: Table<SyncLog, number>;
}): Promise<boolean> {
	const [entryCount, jobCount, metaCount, logCount] = await Promise.all([
		db.entries.count(),
		db.jobs.count(),
		db.meta.count(),
		db.logs.count(),
	]);
	return entryCount + jobCount + metaCount + logCount > 0;
}
