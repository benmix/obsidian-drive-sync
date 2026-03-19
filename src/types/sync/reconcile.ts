import type { SyncEntry, SyncJob } from "@contracts/data/sync-schema";

export type ReconcileResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
};
