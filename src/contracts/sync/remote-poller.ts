import type { SyncEntry, SyncJob } from "../data/sync-schema";

export type RemotePollResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
	removedPaths: string[];
	remoteEventCursor?: string;
};
