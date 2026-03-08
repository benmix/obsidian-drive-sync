import { PluginDataStateStore } from "../../sync/state/state-store";
import type { SyncState } from "../../sync/state/index-store";

export async function loadSyncState(): Promise<SyncState> {
	return await new PluginDataStateStore().load();
}

export async function clearConflictMarker(path: string): Promise<boolean> {
	const stateStore = new PluginDataStateStore();
	const state = await stateStore.load();
	const entry = state.entries[path];
	if (!entry) {
		return false;
	}
	entry.conflict = undefined;
	entry.conflictPending = undefined;
	state.entries[path] = entry;
	await stateStore.save(state);
	return true;
}
