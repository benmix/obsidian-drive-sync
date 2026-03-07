import type { SyncEntry } from "../../data/sync-schema";
import type { SyncState } from "../state/index-store";

function hasSyncedBaselineEntry(entry: SyncEntry): boolean {
	return Boolean(entry.syncedLocalHash || entry.syncedRemoteRev);
}

export function isInitializationPhase(state?: SyncState): boolean {
	if (!state) {
		return true;
	}
	if (state.lastSyncAt) {
		return false;
	}
	return !Object.values(state.entries ?? {}).some(hasSyncedBaselineEntry);
}

export function shouldPreferRemoteSeed(
	state: SyncState | undefined,
	localEntryCount: number,
	remoteEntryCount: number,
): boolean {
	return isInitializationPhase(state) && localEntryCount === 0 && remoteEntryCount > 0;
}
