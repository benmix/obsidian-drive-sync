import type {App} from "obsidian";
import {ObsidianLocalFs} from "../sync/localFs";
import {syncLocalToRemote, syncRemoteToLocal} from "../sync/manualSync";
import {ProtonDriveRemoteFs} from "../sync/remoteFs";
import {SyncEngine} from "../sync/syncEngine";
import {PluginDataStateStore} from "../sync/stateStore";
import {pollRemoteChanges} from "../sync/remotePoller";

type ProtonDriveClient = ConstructorParameters<typeof ProtonDriveRemoteFs>[0];

export async function syncVaultToProtonDrive(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string
): Promise<{uploaded: number}> {
	const localFs = new ObsidianLocalFs(app);
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	return await syncLocalToRemote(localFs, remoteFs);
}

export async function restoreVaultFromProtonDrive(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string
): Promise<{downloaded: number}> {
	const localFs = new ObsidianLocalFs(app);
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	return await syncRemoteToLocal(localFs, remoteFs);
}

export async function planSync(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string
): Promise<{jobsPlanned: number; entries: number}> {
	const localFs = new ObsidianLocalFs(app);
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	const stateStore = new PluginDataStateStore(app);
	const engine = new SyncEngine(localFs, remoteFs, stateStore);
	await engine.load();
	return await engine.plan();
}

export async function runPlannedSync(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string
): Promise<{jobsExecuted: number; entriesUpdated: number}> {
	const localFs = new ObsidianLocalFs(app);
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	const stateStore = new PluginDataStateStore(app);
	const engine = new SyncEngine(localFs, remoteFs, stateStore);
	await engine.load();
	return await engine.runOnce();
}

export async function pollRemoteSync(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string
): Promise<{jobsPlanned: number; entries: number}> {
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	const stateStore = new PluginDataStateStore(app);
	const state = await stateStore.load();
	const result = await pollRemoteChanges(remoteFs, state);
	const engine = new SyncEngine(new ObsidianLocalFs(app), remoteFs, stateStore);
	await engine.load();
	engine.applyEntries(result.snapshot);
	for (const job of result.jobs) {
		engine.enqueue(job);
	}
	await engine.save();
	return {jobsPlanned: result.jobs.length, entries: result.snapshot.length};
}
