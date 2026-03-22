import type { LocalFileSystem, RemoteFileSystem } from "@contracts/filesystem/file-system";
import type { LocalProvider } from "@contracts/provider/local-provider";
import type { AnyRemoteProvider, RemoteProviderClient } from "@contracts/provider/remote-provider";
import { type SyncStrategy } from "@contracts/sync/strategy";
import { syncLocalToRemote, syncRemoteToLocal } from "@runtime/use-cases/manual-sync";
import { SyncEngine } from "@sync/engine/sync-engine";
import { isInitializationPhase } from "@sync/planner/initialization";
import { pollRemoteChanges } from "@sync/planner/remote-poller";
import { PluginDataStateStore } from "@sync/state/state-store";
import { type App } from "obsidian";

type SyncWorkflowSettings = {
	syncStrategy?: SyncStrategy;
};

type SyncFileSystems = {
	localFileSystem: LocalFileSystem;
	remoteFileSystem: RemoteFileSystem;
};

type LoadedSyncEngineContext = SyncFileSystems & {
	stateStore: PluginDataStateStore;
	engine: SyncEngine;
	preferRemoteSeed: boolean;
};

export async function syncVaultToRemote<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
): Promise<{ uploaded: number }> {
	const { localFileSystem, remoteFileSystem } = createSyncFileSystems(
		app,
		localProvider,
		remoteProvider,
		client,
		scopeId,
	);
	return await syncLocalToRemote(localFileSystem, remoteFileSystem);
}

export async function restoreVaultFromRemote<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
): Promise<{ downloaded: number }> {
	const { localFileSystem, remoteFileSystem } = createSyncFileSystems(
		app,
		localProvider,
		remoteProvider,
		client,
		scopeId,
	);
	return await syncRemoteToLocal(localFileSystem, remoteFileSystem);
}

export async function planSync<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: SyncWorkflowSettings,
): Promise<{ jobsPlanned: number; entries: number }> {
	const { engine, preferRemoteSeed } = await createLoadedSyncContext(
		app,
		localProvider,
		remoteProvider,
		client,
		scopeId,
		settings,
	);
	return await engine.plan({ preferRemoteSeed });
}

export async function runPlannedSync<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: SyncWorkflowSettings,
): Promise<{ jobsExecuted: number; entriesUpdated: number }> {
	const { engine } = await createLoadedSyncContext(
		app,
		localProvider,
		remoteProvider,
		client,
		scopeId,
		settings,
	);
	return await engine.runOnce();
}

export async function rebuildSyncIndex<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: SyncWorkflowSettings,
): Promise<void> {
	const { engine } = await createLoadedSyncContext(
		app,
		localProvider,
		remoteProvider,
		client,
		scopeId,
		settings,
	);
	await engine.rebuildIndex();
}

export async function pollRemoteSync<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: SyncWorkflowSettings,
): Promise<{ jobsPlanned: number; entries: number }> {
	const { remoteFileSystem, engine, preferRemoteSeed } = await createLoadedSyncContext(
		app,
		localProvider,
		remoteProvider,
		client,
		scopeId,
		settings,
	);
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
	return {
		jobsPlanned: result.jobs.length,
		entries: result.snapshot.length,
	};
}

export async function estimateSyncPlan<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings?: SyncWorkflowSettings,
): Promise<{
	jobsPlanned: number;
	entries: number;
	uploadBytes: number;
	downloadBytes: number;
}> {
	const { localFileSystem, remoteFileSystem, stateStore, engine, preferRemoteSeed } =
		await createLoadedSyncContext(
			app,
			localProvider,
			remoteProvider,
			client,
			scopeId,
			settings,
		);
	const originalState = await stateStore.load();
	try {
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

function createSyncFileSystems<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
): SyncFileSystems {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	return { localFileSystem, remoteFileSystem };
}

async function createLoadedSyncContext<TProvider extends AnyRemoteProvider>(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: TProvider,
	client: RemoteProviderClient<TProvider>,
	scopeId: string,
	settings: SyncWorkflowSettings | undefined,
): Promise<LoadedSyncEngineContext> {
	const { localFileSystem, remoteFileSystem } = createSyncFileSystems(
		app,
		localProvider,
		remoteProvider,
		client,
		scopeId,
	);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
		syncStrategy: settings?.syncStrategy,
	});
	await engine.load();
	return {
		localFileSystem,
		remoteFileSystem,
		stateStore,
		engine,
		preferRemoteSeed: await shouldPreferRemoteSeed(engine, localFileSystem),
	};
}

async function shouldPreferRemoteSeed(
	engine: SyncEngine,
	localFileSystem: LocalFileSystem,
): Promise<boolean> {
	return (
		isInitializationPhase(engine.getStateSnapshot()) &&
		(await localFileSystem.listEntries()).length === 0
	);
}
