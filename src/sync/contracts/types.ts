import type { LocalChange } from "../../filesystem/contracts";

export type SyncRunTrigger = "manual" | "interval" | "local";
export type SyncRunRequest = {
	trigger: SyncRunTrigger;
	force: boolean;
	localChanges: LocalChange[];
};
