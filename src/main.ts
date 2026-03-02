import { Notice, Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { ProtonDriveAuthService } from "./proton-drive/auth";
import { ProtonDriveService } from "./proton-drive/service";
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
	settings: ProtonDriveSettings = DEFAULT_SETTINGS;
	protonDriveService: ProtonDriveService = new ProtonDriveService();
	authService: ProtonDriveAuthService = new ProtonDriveAuthService();

	private autoSyncIntervalId: number | null = null;
	private localWatcher: LocalFsWatcher | null = null;
	private localChangeQueue: LocalChange[] = [];
	private localRunTimeout: number | null = null;
	private autoSyncRunning = false;
	private autoSyncPending = false;
	private autoSyncPaused = false;
	private authPaused = false;
	private lastAuthError: string | undefined;
	private lastBackgroundReconcileAt = 0;

	async onload() {
		const data = await loadPluginData(this);
		this.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
		await this.restoreSession();

		this.addSettingTab(new ProtonDriveSettingTab(this.app, this));
		registerCommands(this);
		this.refreshAutoSync();
	}

	onunload() {
		this.stopAutoSync();
	}

	async saveSettings(): Promise<void> {
		const data = mergePluginData(await loadPluginData(this));
		data.settings = { ...this.settings };
		await savePluginData(this, data);
	}

	private async restoreSession(): Promise<void> {
		const credentials = this.settings.protonSession;
		if (!credentials) {
			this.settings.hasAuthSession = false;
			return;
		}

		try {
			await this.authService.restore(credentials);
			this.settings.hasAuthSession = true;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to restore Proton session.";
			console.warn("Failed to restore Proton session.", error);
			this.settings.protonSession = undefined;
			this.settings.hasAuthSession = false;
			this.settings.accountEmail = "";
			await this.saveSettings();
			this.authPaused = true;
			this.lastAuthError = message;
		}
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
		this.authPaused = false;
		this.scheduleAutoSync(0, "manual");
	}

	isAutoSyncPaused(): boolean {
		return this.autoSyncPaused;
	}

	isAuthPaused(): boolean {
		return this.authPaused;
	}

	getLastAuthError(): string | undefined {
		return this.lastAuthError;
	}

	async runAutoSync(force = false): Promise<void> {
		await this.performAutoSync("manual", force || this.autoSyncPaused);
	}

	isSyncRunning(): boolean {
		return this.autoSyncRunning;
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
		if (!this.settings.autoSyncEnabled || this.autoSyncPaused || this.authPaused) {
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
		if (!this.settings.remoteFolderId.trim()) {
			return;
		}
		if ((this.autoSyncPaused || this.authPaused) && !force) {
			return;
		}
		if (this.autoSyncRunning) {
			this.autoSyncPending = true;
			return;
		}

		this.autoSyncRunning = true;

		try {
			const nowTs = now();
			const shouldReconcile =
				force || nowTs - this.lastBackgroundReconcileAt > 15 * 60 * 1000;
			const session = this.authService.getSession();
			if (!session) {
				throw new Error("Sign in to Proton Drive first.");
			}

			const activeSession: import("./proton-drive/sdk-session").ProtonSession = {
				...session,
			};
			activeSession.onTokenRefresh = async () => {
				try {
					await this.authService.refreshToken();
					const refreshedSession = this.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					this.settings.protonSession = this.authService.getReusableCredentials();
					this.settings.hasAuthSession = true;
					await this.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					this.settings.hasAuthSession = false;
					this.authPaused = true;
					this.lastAuthError =
						refreshError instanceof Error
							? refreshError.message
							: "Failed to refresh Proton session.";
					await this.saveSettings();
				}
			};
			const client = await this.protonDriveService.connect(activeSession);
			if (!client) {
				throw new Error("Unable to connect to Proton Drive.");
			}

			const localFs = new ObsidianLocalFs(this.app);
			const remoteFs = new ProtonDriveRemoteFs(client, this.settings.remoteFolderId);
			const stateStore = new PluginDataStateStore();
			const state = await stateStore.load();
			const engine = new SyncEngine(localFs, remoteFs, stateStore, {
				maxConcurrentJobs: this.settings.maxConcurrentJobs,
				maxRetryAttempts: this.settings.maxRetryAttempts,
				excludePatterns: this.settings.excludePatterns,
				conflictStrategy: this.settings.conflictStrategy,
				onAuthError: (message) => {
					this.authPaused = true;
					this.lastAuthError = message;
				},
			});
			await engine.load();

			const localChanges = this.drainLocalChanges();
			if (localChanges.length > 0) {
				const plan = planLocalChanges(localChanges, state);
				engine.applyEntries(plan.entries);
				engine.removeEntries(plan.removedPaths);
				if (plan.rewritePrefixes.length > 0) {
					engine.rewritePaths(plan.rewritePrefixes);
				}
				for (const job of plan.jobs) {
					engine.enqueue(job);
				}
			}

			if (trigger !== "local" || localChanges.length === 0 || shouldReconcile) {
				const remotePlan = await pollRemoteChanges(remoteFs, state);
				engine.applyEntries(remotePlan.snapshot);
				engine.removeEntries(remotePlan.removedPaths);
				for (const job of remotePlan.jobs) {
					engine.enqueue(job);
				}
				if (remotePlan.remoteEventCursor) {
					await engine.save({
						remoteEventCursor: remotePlan.remoteEventCursor,
					});
				}
			}

			if (shouldReconcile) {
				const reconcile = await engine.plan();
				if (reconcile.jobsPlanned > 0) {
					this.lastBackgroundReconcileAt = nowTs;
				}
			}

			if (engine.listJobs().length === 0) {
				await engine.save({
					lastError: undefined,
					lastErrorAt: undefined,
				});
				return;
			}
			await engine.runOnce();
			if (shouldReconcile) {
				this.lastBackgroundReconcileAt = nowTs;
			}
			if (this.authPaused && trigger === "manual") {
				new Notice("Authentication required. Sync paused.");
			}
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
		const stateStore = new PluginDataStateStore();
		const state = await stateStore.load();
		await stateStore.save({
			...state,
			lastError: message,
			lastErrorAt: now(),
		});
	}
}
