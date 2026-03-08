import type { SyncEntry, SyncJob } from "../data/sync-schema";

export type PresenceDecision = {
	job?: SyncJob;
	removePriorPath?: boolean;
};

export type BothChangedDecision = {
	jobs: SyncJob[];
	conflict?: SyncEntry["conflict"];
	conflictPending?: boolean;
};

export type RemoteMissingConfirmation = {
	confirmed: boolean;
	nextCount: number;
	sinceMs: number;
};
