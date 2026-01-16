import { Notice, Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { ProtonDriveAuthService } from "./proton-drive/auth";
import { ProtonDriveService } from "./proton-drive/service";
import { buildSdkOptions } from "./proton-drive/sdk-options";
import { ProtonDriveSettingTab, type ProtonDriveSettings, DEFAULT_SETTINGS } from "./settings";
import { loadPluginData, mergePluginData, savePluginData } from "./data/plugin-data";
import { LocalFsWatcher, type LocalChange } from "./sync/local-watcher";
import { planLocalChanges } from "./sync/local-change-planner";
import { ObsidianLocalFs } from "./sync/local-fs";
import { ProtonDriveRemoteFs } from "./sync/remote-fs";
import { SyncEngine } from "./sync/sync-engine";
import { PluginDataStateStore } from "./sync/state-store";
import { pollRemoteChanges } from "./sync/remote-poller";
import { now } from "./sync/utils";

type AutoSyncTrigger = "manual" | "interval" | "local";

export default class ProtonDriveSyncPlugin extends Plugin {
	settings: ProtonDriveSettings;
	protonDriveService: ProtonDriveService;
	authService: ProtonDriveAuthService;

	private autoSyncIntervalId: number | null = null;
	private localWatcher: LocalFsWatcher | null = null;
	private localChangeQueue: LocalChange[] = [];
	private localRunTimeout: number | null = null;
	private autoSyncRunning = false;
	private autoSyncPending = false;
	private autoSyncPaused = false;

	async onload() {
		const data = loadPluginData(this.app);
		this.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
		this.protonDriveService = new ProtonDriveService();
		this.authService = new ProtonDriveAuthService();

		this.addSettingTab(new ProtonDriveSettingTab(this.app, this));
		registerCommands(this);
		this.refreshAutoSync();
	}

	onunload() {
		this.stopAutoSync();
	}

	async saveSettings(): Promise<void> {
		const data = mergePluginData(loadPluginData(this.app));
		data.settings = { ...this.settings };
		savePluginData(this.app, data);
	}

	refreshAutoSync(): void {
		this.stopAutoSync();

		if (!this.settings.autoSyncEnabled) {
			return;
		}

		this.startAutoSync();
	}

	pauseAutoSync(): void {
		this.autoSyncPaused = true;
	}

	resumeAutoSync(): void {
		this.autoSyncPaused = false;
		this.scheduleAutoSync(0, "manual");
	}

	isAutoSyncPaused(): boolean {
		return this.autoSyncPaused;
	}

	async runAutoSync(force = false): Promise<void> {
		await this.performAutoSync("manual", force || this.autoSyncPaused);
	}

	private startAutoSync(): void {
		this.autoSyncPaused = false;
		this.localWatcher = new LocalFsWatcher(
			this.app,
			(change) => this.handleLocalChange(change),
			this.registerEvent.bind(this),
			this.settings.localChangeDebounceMs,
		);
		this.localWatcher.start();

		this.autoSyncIntervalId = window.setInterval(() => {
			void this.performAutoSync("interval");
		}, this.settings.autoSyncIntervalMs);
		this.registerInterval(this.autoSyncIntervalId);

		this.scheduleAutoSync(0, "interval");
	}

	private stopAutoSync(): void {
		if (this.autoSyncIntervalId !== null) {
			window.clearInterval(this.autoSyncIntervalId);
			this.autoSyncIntervalId = null;
		}
		if (this.localRunTimeout !== null) {
			window.clearTimeout(this.localRunTimeout);
			this.localRunTimeout = null;
		}
		if (this.localWatcher) {
			this.localWatcher.stop();
			this.localWatcher = null;
		}
		this.localChangeQueue = [];
		this.autoSyncPending = false;
		this.autoSyncRunning = false;
	}

	private handleLocalChange(change: LocalChange): void {
		this.localChangeQueue.push(change);
		this.scheduleAutoSync(Math.max(500, this.settings.localChangeDebounceMs), "local");
	}

	private scheduleAutoSync(delayMs: number, trigger: AutoSyncTrigger): void {
		if (!this.settings.autoSyncEnabled || this.autoSyncPaused) {
			return;
		}
		if (this.localRunTimeout !== null) {
			return;
		}
		this.localRunTimeout = window.setTimeout(() => {
			this.localRunTimeout = null;
			void this.performAutoSync(trigger);
		}, delayMs);
	}

	private drainLocalChanges(): LocalChange[] {
		const changes = this.localChangeQueue;
		this.localChangeQueue = [];
		return changes;
	}

	private async performAutoSync(trigger: AutoSyncTrigger, force = false): Promise<void> {
		if (!this.settings.enableProtonDrive) {
			return;
		}
		if (!this.settings.remoteFolderId.trim()) {
			return;
		}
		if (this.autoSyncPaused && !force) {
			return;
		}
		if (this.autoSyncRunning) {
			this.autoSyncPending = true;
			return;
		}

		this.autoSyncRunning = true;

		try {
			const { options, error } = buildSdkOptions(
				this.settings.sdkOptionsJson,
				this.settings.sessionToken,
			);
			if (error) {
				throw new Error(error);
			}

			const client = await this.protonDriveService.connect(options);
			if (!client) {
				throw new Error("Unable to connect to Proton Drive.");
			}

			const localFs = new ObsidianLocalFs(this.app);
			const remoteFs = new ProtonDriveRemoteFs(client, this.settings.remoteFolderId);
			const stateStore = new PluginDataStateStore(this.app);
			const state = await stateStore.load();
			const engine = new SyncEngine(localFs, remoteFs, stateStore);
			await engine.load();

			const localChanges = this.drainLocalChanges();
			if (localChanges.length > 0) {
				const plan = planLocalChanges(localChanges, state);
				engine.applyEntries(plan.entries);
				engine.removeEntries(plan.removedPaths);
				for (const job of plan.jobs) {
					engine.enqueue(job);
				}
			}

			if (trigger !== "local" || localChanges.length === 0) {
				const remotePlan = await pollRemoteChanges(remoteFs, state);
				engine.applyEntries(remotePlan.snapshot);
				engine.removeEntries(remotePlan.removedPaths);
				for (const job of remotePlan.jobs) {
					engine.enqueue(job);
				}
			}

			if (engine.listJobs().length === 0) {
				await engine.save({ lastError: undefined, lastErrorAt: undefined });
				return;
			}

			await engine.runOnce();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Auto sync failed.";
			console.warn("Auto sync failed.", error);
			await this.recordSyncError(message);
			if (trigger === "manual") {
				new Notice(message);
			}
		} finally {
			this.autoSyncRunning = false;
			if (this.autoSyncPending) {
				this.autoSyncPending = false;
				void this.performAutoSync("interval");
			}
		}
	}

	private async recordSyncError(message: string): Promise<void> {
		const stateStore = new PluginDataStateStore(this.app);
		const state = await stateStore.load();
		await stateStore.save({
			...state,
			lastError: message,
			lastErrorAt: now(),
		});
	}
}
