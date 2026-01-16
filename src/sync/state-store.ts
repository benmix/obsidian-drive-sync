import type { App } from "obsidian";
import type { SyncState } from "./index-types";
import { DEFAULT_SYNC_STATE } from "./index-types";
import { loadPluginData, mergePluginData, savePluginData } from "../data/plugin-data";

export type StateStore = {
	load(): Promise<SyncState>;
	save(state: SyncState): Promise<void>;
};

export class PluginDataStateStore implements StateStore {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async load(): Promise<SyncState> {
		const data = loadPluginData(this.app);
		const state = data.syncState ?? DEFAULT_SYNC_STATE;
		return {
			entries: state.entries ?? {},
			jobs: state.jobs ?? [],
			lastSyncAt: state.lastSyncAt,
			lastError: state.lastError,
			lastErrorAt: state.lastErrorAt,
		};
	}

	async save(state: SyncState): Promise<void> {
		const data = mergePluginData(loadPluginData(this.app));
		data.syncState = state;
		savePluginData(this.app, data);
	}
}
