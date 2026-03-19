import type { SyncEntry, SyncLog } from "@contracts/data/sync-schema";
import type { SyncRuntimeMetrics, SyncState } from "@contracts/sync/state";
import type { StateStore } from "@contracts/sync/state-store";
import { ensureSyncStateDbReady, syncStateDb } from "@data/sync-db";

export class PluginDataStateStore implements StateStore {
	async load(): Promise<SyncState> {
		await ensureSyncStateDbReady();
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
			lastErrorAt: metaMap.get("lastErrorAt") as number | undefined,
			lastErrorCode: metaMap.get("lastErrorCode") as SyncState["lastErrorCode"],
			lastErrorCategory: metaMap.get("lastErrorCategory") as SyncState["lastErrorCategory"],
			lastErrorRetryable: metaMap.get("lastErrorRetryable") as boolean | undefined,
			remoteEventCursor: metaMap.get("remoteEventCursor") as string | undefined,
			runtimeMetrics: parseRuntimeMetrics(metaMap.get("runtimeMetrics")),
			logs: logs.map(mapLog),
		};
	}

	async save(state: SyncState): Promise<void> {
		await ensureSyncStateDbReady();
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
					{ key: "lastErrorAt", value: state.lastErrorAt },
					{ key: "lastErrorCode", value: state.lastErrorCode },
					{
						key: "lastErrorCategory",
						value: state.lastErrorCategory,
					},
					{
						key: "lastErrorRetryable",
						value: state.lastErrorRetryable,
					},
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

function mapLog(log: SyncLog): SyncLog {
	return {
		at: log.at,
		message: log.message,
		context: log.context,
		code: log.code,
		category: log.category,
		retryable: log.retryable,
		path: log.path,
		jobId: log.jobId,
		jobOp: log.jobOp,
		provider: log.provider,
		details: log.details,
	};
}

function toLog(log: SyncLog): SyncLog {
	return {
		at: log.at,
		message: log.message,
		context: log.context,
		code: log.code,
		category: log.category,
		retryable: log.retryable,
		path: log.path,
		jobId: log.jobId,
		jobOp: log.jobOp,
		provider: log.provider,
		details: log.details,
	};
}

function parseRuntimeMetrics(value?: string | number | boolean): SyncRuntimeMetrics | undefined {
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
