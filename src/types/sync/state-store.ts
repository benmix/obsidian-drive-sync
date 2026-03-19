import type { SyncState } from "@contracts/sync/state";

export type StateStore = {
	load(): Promise<SyncState>;
	save(state: SyncState): Promise<void>;
};
