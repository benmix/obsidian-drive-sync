import type { App, Plugin } from "obsidian";
import { ObsidianLocalFs } from "../sync/local-fs";
import { syncLocalToRemote, syncRemoteToLocal } from "../sync/manual-sync";
import { ProtonDriveRemoteFs } from "../sync/remote-fs";
import { SyncEngine } from "../sync/sync-engine";
import { PluginDataStateStore } from "../sync/state-store";
import { pollRemoteChanges } from "../sync/remote-poller";
import type { ProtonDriveClient } from "@protontech/drive-sdk";

export async function syncVaultToProtonDrive(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string,
	options?: { excludePatterns?: string },
): Promise<{ uploaded: number }> {
	const localFs = new ObsidianLocalFs(app);
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	return await syncLocalToRemote(localFs, remoteFs, options?.excludePatterns);
}

export async function restoreVaultFromProtonDrive(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string,
	options?: { excludePatterns?: string },
): Promise<{ downloaded: number }> {
	const localFs = new ObsidianLocalFs(app);
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	return await syncRemoteToLocal(localFs, remoteFs, options?.excludePatterns);
}

export async function planSync(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string,
	plugin: Plugin,
	settings?: {
		excludePatterns?: string;
		conflictStrategy?: "local-wins" | "remote-wins" | "manual";
		maxConcurrentJobs?: number;
		maxRetryAttempts?: number;
	},
): Promise<{ jobsPlanned: number; entries: number }> {
	const localFs = new ObsidianLocalFs(app);
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFs, remoteFs, stateStore, {
		excludePatterns: settings?.excludePatterns,
		conflictStrategy: settings?.conflictStrategy,
		maxConcurrentJobs: settings?.maxConcurrentJobs,
		maxRetryAttempts: settings?.maxRetryAttempts,
	});
	await engine.load();
	return await engine.plan();
}

export async function runPlannedSync(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string,
	plugin: Plugin,
	settings?: {
		excludePatterns?: string;
		conflictStrategy?: "local-wins" | "remote-wins" | "manual";
		maxConcurrentJobs?: number;
		maxRetryAttempts?: number;
	},
): Promise<{ jobsExecuted: number; entriesUpdated: number }> {
	const localFs = new ObsidianLocalFs(app);
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	const stateStore = new PluginDataStateStore();
	const engine = new SyncEngine(localFs, remoteFs, stateStore, {
		excludePatterns: settings?.excludePatterns,
		conflictStrategy: settings?.conflictStrategy,
		maxConcurrentJobs: settings?.maxConcurrentJobs,
		maxRetryAttempts: settings?.maxRetryAttempts,
	});
	await engine.load();
	return await engine.runOnce();
}

export async function pollRemoteSync(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string,
	plugin: Plugin,
	settings?: {
		excludePatterns?: string;
		conflictStrategy?: "local-wins" | "remote-wins" | "manual";
		maxConcurrentJobs?: number;
		maxRetryAttempts?: number;
	},
): Promise<{ jobsPlanned: number; entries: number }> {
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	const stateStore = new PluginDataStateStore();
	const state = await stateStore.load();
	const result = await pollRemoteChanges(remoteFs, state);
	const engine = new SyncEngine(new ObsidianLocalFs(app), remoteFs, stateStore, {
		excludePatterns: settings?.excludePatterns,
		conflictStrategy: settings?.conflictStrategy,
		maxConcurrentJobs: settings?.maxConcurrentJobs,
		maxRetryAttempts: settings?.maxRetryAttempts,
	});
	await engine.load();
	engine.applyEntries(result.snapshot);
	engine.removeEntries(result.removedPaths);
	for (const job of result.jobs) {
		engine.enqueue(job);
	}
	await engine.save({ remoteEventCursor: result.remoteEventCursor });
	return { jobsPlanned: result.jobs.length, entries: result.snapshot.length };
}
