import type { DriveSyncSettings } from "../plugin/settings";

export type PluginDataStore = {
	loadData: () => Promise<unknown>;
	saveData: (data: unknown) => Promise<void>;
};

export type PluginData = {
	settings: DriveSyncSettings;
};
