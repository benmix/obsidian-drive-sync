import type { SyncEntry, SyncLog } from "../data/sync-schema";
import type { SyncRuntimeMetrics, SyncState } from "./index-store";
import { syncStateDb } from "../data/sync-db";

export type StateStore = {
	load(): Promise<SyncState>;
	save(state: SyncState): Promise<void>;
};

export class PluginDataStateStore implements StateStore {
	async load(): Promise<SyncState> {
		const [entries, jobs, meta, logs] = await Promise.all([
			syncStateDb.entries.toArray(),
			syncStateDb.jobs.toArray(),
			syncStateDb.meta.toArray(),
			syncStateDb.logs.toArray(),
		]);
		const entriesMap: Record<string, SyncEntry> = {};
		for (const entry of entries) {
			entriesMap[entry.relPath] = entry;
		}
		const metaMap = new Map(meta.map((item) => [item.key, item.value]));
		return {
			entries: entriesMap,
			jobs,
			lastSyncAt: metaMap.get("lastSyncAt") as number | undefined,
			lastError: metaMap.get("lastError") as string | undefined,
			lastErrorAt: metaMap.get("lastErrorAt") as number | undefined,
			remoteEventCursor: metaMap.get("remoteEventCursor") as string | undefined,
			runtimeMetrics: parseRuntimeMetrics(metaMap.get("runtimeMetrics")),
			logs: logs.map(mapLog),
		};
	}

	async save(state: SyncState): Promise<void> {
		const entries = Object.values(state.entries ?? {});
		const jobs = state.jobs ?? [];
		const logs = (state.logs ?? []).map(toLog);
		await syncStateDb.transaction(
			"rw",
			syncStateDb.entries,
			syncStateDb.jobs,
			syncStateDb.meta,
			syncStateDb.logs,
			async () => {
				await syncStateDb.entries.clear();
				await syncStateDb.jobs.clear();
				await syncStateDb.meta.clear();
				await syncStateDb.logs.clear();

				if (entries.length > 0) {
					await syncStateDb.entries.bulkPut(entries);
				}
				if (jobs.length > 0) {
					await syncStateDb.jobs.bulkPut(jobs);
				}
				if (logs.length > 0) {
					await syncStateDb.logs.bulkPut(logs);
				}
				await syncStateDb.meta.bulkPut([
					{ key: "lastSyncAt", value: state.lastSyncAt },
					{ key: "lastError", value: state.lastError },
					{ key: "lastErrorAt", value: state.lastErrorAt },
					{
						key: "remoteEventCursor",
						value: state.remoteEventCursor,
					},
					{
						key: "runtimeMetrics",
						value: serializeRuntimeMetrics(state.runtimeMetrics),
					},
				]);
			},
		);
	}
}

function mapLog(log: SyncLog): {
	at: string;
	message: string;
	context?: string;
} {
	return { at: log.at, message: log.message, context: log.context };
}

function toLog(log: { at: string; message: string; context?: string }): SyncLog {
	return { at: log.at, message: log.message, context: log.context };
}

function parseRuntimeMetrics(value?: string | number): SyncRuntimeMetrics | undefined {
	if (!value || typeof value !== "string") {
		return undefined;
	}
	try {
		return JSON.parse(value) as SyncRuntimeMetrics;
	} catch {
		return undefined;
	}
}

function serializeRuntimeMetrics(value?: SyncRuntimeMetrics): string | undefined {
	if (!value || Object.keys(value).length === 0) {
		return undefined;
	}
	return JSON.stringify(value);
}
