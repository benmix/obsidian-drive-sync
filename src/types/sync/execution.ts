import type { SyncEntry } from "@contracts/data/sync-schema";

export type ExecuteResult = {
	entries: SyncEntry[];
	jobsExecuted: number;
	uploadBytes: number;
	downloadBytes: number;
};
