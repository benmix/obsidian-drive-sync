import { type LocalProvider, type RemoteProvider } from "../../provider/contracts";
import { syncLocalToRemote, syncRemoteToLocal } from "./manual-sync";
import { type App } from "obsidian";
import { PluginDataStateStore } from "../../sync/state/state-store";
import { pollRemoteChanges } from "../../sync/planner/remote-poller";
import { SyncEngine } from "../../sync/engine/sync-engine";

export async function syncVaultToRemote(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: RemoteProvider,
	client: unknown,
	scopeId: string,
): Promise<{ uploaded: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	return await syncLocalToRemote(localFileSystem, remoteFileSystem);
}

export async function restoreVaultFromRemote(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: RemoteProvider,
	client: unknown,
	scopeId: string,
): Promise<{ downloaded: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	return await syncRemoteToLocal(localFileSystem, remoteFileSystem);
}

export async function planSync(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: RemoteProvider,
	client: unknown,
	scopeId: string,
	settings?: {
		conflictStrategy?: "local-wins" | "remote-wins" | "manual";
	},
): Promise<{ jobsPlanned: number; entries: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
		conflictStrategy: settings?.conflictStrategy,
	});
	await engine.load();
	return await engine.plan();
}

export async function runPlannedSync(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: RemoteProvider,
	client: unknown,
	scopeId: string,
	settings?: {
		conflictStrategy?: "local-wins" | "remote-wins" | "manual";
	},
): Promise<{ jobsExecuted: number; entriesUpdated: number }> {
	const localFileSystem = localProvider.createLocalFileSystem(app);
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
		conflictStrategy: settings?.conflictStrategy,
	});
	await engine.load();
	return await engine.runOnce();
}

export async function pollRemoteSync(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: RemoteProvider,
	client: unknown,
	scopeId: string,
	settings?: {
		conflictStrategy?: "local-wins" | "remote-wins" | "manual";
	},
): Promise<{ jobsPlanned: number; entries: number }> {
	const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(
		localProvider.createLocalFileSystem(app),
		remoteFileSystem,
		stateStore,
		{
			conflictStrategy: settings?.conflictStrategy,
		},
	);
	await engine.load();
	const result = await pollRemoteChanges(remoteFileSystem, engine.getStateSnapshot(), {
		conflictStrategy: settings?.conflictStrategy,
	});
	engine.applyEntries(result.snapshot);
	engine.removeEntries(result.removedPaths);
	for (const job of result.jobs) {
		engine.enqueue(job);
	}
	await engine.save({ remoteEventCursor: result.remoteEventCursor });
	return { jobsPlanned: result.jobs.length, entries: result.snapshot.length };
}

export async function estimateSyncPlan(
	app: App,
	localProvider: LocalProvider,
	remoteProvider: RemoteProvider,
	client: unknown,
	scopeId: string,
	settings?: {
		conflictStrategy?: "local-wins" | "remote-wins" | "manual";
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
		conflictStrategy: settings?.conflictStrategy,
	});
	try {
		await engine.load();
		const plan = await engine.plan();
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
			if (job.op === "download" && job.remoteId && remoteFileSystem.getNode) {
				const node = await remoteFileSystem.getNode(job.remoteId);
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
