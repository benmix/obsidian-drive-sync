import type { SyncEntry, SyncJob } from "@contracts/data/sync-schema";

export type LocalChangePlan = {
	jobs: SyncJob[];
	entries: SyncEntry[];
	removedPaths: string[];
	rewritePrefixes: Array<{ from: string; to: string }>;
};
