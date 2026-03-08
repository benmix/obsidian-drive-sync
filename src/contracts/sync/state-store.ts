import type { SyncState } from "./state";

export type StateStore = {
	load(): Promise<SyncState>;
	save(state: SyncState): Promise<void>;
};
