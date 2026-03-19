import type { SyncEntry, SyncJob } from "@contracts/data/sync-schema";

export type RemotePollResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
	removedPaths: string[];
	remoteEventCursor?: string;
};
