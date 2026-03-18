import { type App } from "obsidian";

import type { LocalProvider } from "../../contracts/provider/local-provider";
import type {
	AnyRemoteProvider,
	RemoteProviderClient,
} from "../../contracts/provider/remote-provider";
import { type SyncStrategy } from "../../contracts/sync/strategy";
import { SyncEngine } from "../../sync/engine/sync-engine";
import { isInitializationPhase } from "../../sync/planner/initialization";
import { pollRemoteChanges } from "../../sync/planner/remote-poller";
import { PluginDataStateStore } from "../../sync/state/state-store";

import { syncLocalToRemote, syncRemoteToLocal } from "./manual-sync";

export async function syncVaultToRemote<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
): Promise<{ uploaded: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	return await syncLocalToRemote(localFileSystem, remoteFileSystem);
}

export async function restoreVaultFromRemote<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
): Promise<{ downloaded: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	return await syncRemoteToLocal(localFileSystem, remoteFileSystem);
}

export async function planSync<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: {
		syncStrategy?: SyncStrategy;
	},
): Promise<{ jobsPlanned: number; entries: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
		syncStrategy: settings?.syncStrategy,
	});
	await engine.load();
	const preferRemoteSeed =
		isInitializationPhase(engine.getStateSnapshot()) &&
		(await localFileSystem.listEntries()).length === 0;
	return await engine.plan({ preferRemoteSeed });
}

export async function runPlannedSync<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: {
		syncStrategy?: SyncStrategy;
	},
): Promise<{ jobsExecuted: number; entriesUpdated: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
		syncStrategy: settings?.syncStrategy,
	});
	await engine.load();
	return await engine.runOnce();
}

export async function rebuildSyncIndex<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: {
		syncStrategy?: SyncStrategy;
	},
): Promise<void> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
		syncStrategy: settings?.syncStrategy,
	});
	await engine.load();
	await engine.rebuildIndex();
}

export async function pollRemoteSync<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: {
		syncStrategy?: SyncStrategy;
	},
): Promise<{ jobsPlanned: number; entries: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
		syncStrategy: settings?.syncStrategy,
	});
	await engine.load();
	const preferRemoteSeed =
		isInitializationPhase(engine.getStateSnapshot()) &&
		(await localFileSystem.listEntries()).length === 0;
	const result = await pollRemoteChanges(remoteFileSystem, engine.getStateSnapshot(), {
		syncStrategy: settings?.syncStrategy,
		preferRemoteSeed,
	});
	engine.applyEntries(result.snapshot);
	engine.removeEntries(result.removedPaths);
	for (const job of result.jobs) {
		engine.enqueue(job);
	}
	await engine.save({ remoteEventCursor: result.remoteEventCursor });
	return { jobsPlanned: result.jobs.length, entries: result.snapshot.length };
}

export async function estimateSyncPlan<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: {
		syncStrategy?: SyncStrategy;
	},
): Promise<{
	jobsPlanned: number;
	entries: number;
	uploadBytes: number;
	downloadBytes: number;
}> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	const stateStore = new PluginDataStateStore();
	const originalState = await stateStore.load();
	const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
		syncStrategy: settings?.syncStrategy,
	});
	try {
		await engine.load();
		const preferRemoteSeed =
			isInitializationPhase(engine.getStateSnapshot()) &&
			(await localFileSystem.listEntries()).length === 0;
		const plan = await engine.plan({ preferRemoteSeed });
		const jobs = engine.listJobs();

		let uploadBytes = 0;
		let downloadBytes = 0;
		const localEntries = await localFileSystem.listEntries();
		const localByPath = new Map(localEntries.map((entry) => [entry.path, entry]));
		for (const job of jobs) {
			if (job.op === "upload") {
				const entry = localByPath.get(job.path);
				if (entry?.size) {
					uploadBytes += entry.size;
				}
			}
			if (job.op === "download" && job.remoteId && remoteFileSystem.getEntry) {
				const node = await remoteFileSystem.getEntry(job.remoteId);
				if (node?.size) {
					downloadBytes += node.size;
				}
			}
		}

		return {
			jobsPlanned: plan.jobsPlanned,
			entries: plan.entries,
			uploadBytes,
			downloadBytes,
		};
	} finally {
		await stateStore.save(originalState);
	}
}
