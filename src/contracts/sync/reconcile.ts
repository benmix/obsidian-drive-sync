import type { SyncEntry, SyncJob } from "../data/sync-schema";

export type ReconcileResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
};
