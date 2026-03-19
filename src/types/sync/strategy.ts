export type SyncStrategy = "local_win" | "remote_win" | "bidirectional";

export const DEFAULT_SYNC_STRATEGY: SyncStrategy = "bidirectional";

export function normalizeSyncStrategy(value: unknown): SyncStrategy | undefined {
	if (value === "local_win" || value === "remote_win" || value === "bidirectional") {
		return value;
	}
	return undefined;
}
