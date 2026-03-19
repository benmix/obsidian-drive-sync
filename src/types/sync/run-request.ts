import type { LocalChange } from "@contracts/filesystem/file-system";

export type SyncRunTrigger = "manual" | "interval" | "local";
export type SyncRunRequest = {
	trigger: SyncRunTrigger;
	force: boolean;
	localChanges: LocalChange[];
};
