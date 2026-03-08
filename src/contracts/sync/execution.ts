import type { SyncEntry } from "../data/sync-schema";

export type ExecuteResult = {
	entries: SyncEntry[];
	jobsExecuted: number;
	uploadBytes: number;
	downloadBytes: number;
};
