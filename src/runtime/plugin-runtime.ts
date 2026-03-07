import { INTERNAL_NETWORK_POLICY_FAILURE_COOLDOWN_MS } from "../internal-config";
import { NetworkPolicy } from "./network-policy";
import { Notice } from "obsidian";
import { now } from "../sync/support/utils";
import { type ObsidianDriveSyncPluginApi } from "../plugin/contracts";
import { PluginDataStateStore } from "../sync/state/state-store";
import type { RemoteProviderSession } from "../provider/contracts";
import { SessionManager } from "./session-manager";
import { SyncCoordinator } from "./sync-coordinator";
import { type SyncRunRequest } from "../sync/contracts/types";
import { TriggerScheduler } from "./trigger-scheduler";

export class PluginRuntime {
	private autoSyncPaused = false;
	private readonly sessionManager: SessionManager;
	private readonly syncCoordinator: SyncCoordinator;
	private readonly triggerScheduler: TriggerScheduler;
	private readonly networkPolicy: NetworkPolicy;

	constructor(private readonly plugin: ObsidianDriveSyncPluginApi) {
		this.sessionManager = new SessionManager(plugin);
		this.syncCoordinator = new SyncCoordinator(plugin, this.sessionManager);
		this.networkPolicy = new NetworkPolicy(() => ({
			enabled: this.plugin.settings.enableNetworkPolicy,
			onlineOnly: true,
			failureCooldownMs: INTERNAL_NETWORK_POLICY_FAILURE_COOLDOWN_MS,
		}));
		this.triggerScheduler = new TriggerScheduler({
			createLocalWatcher: (onChange, debounceMs) =>
				plugin
					.getLocalProvider()
					.createLocalWatcher(
						plugin.app,
						onChange,
						plugin.registerEvent.bind(plugin),
						debounceMs,
					),
			registerInterval: plugin.registerInterval.bind(plugin),
			isAutoSyncEnabled: () => this.plugin.settings.autoSyncEnabled,
			isAutoSyncPaused: () => this.autoSyncPaused,
			isAuthPaused: () => this.sessionManager.isAuthPaused(),
			onRunRequest: async (request) => {
				await this.performAutoSync(request);
			},
		});
	}

	async restoreSession(): Promise<void> {
		await this.sessionManager.restoreSession();
	}

	async buildActiveRemoteSession(): Promise<RemoteProviderSession | null> {
		return await this.sessionManager.buildActiveRemoteSession();
	}

	async connectRemoteClient(): Promise<unknown | null> {
		try {
			return await this.sessionManager.connectClient();
		} catch {
			return null;
		}
	}

	refreshAutoSync(): void {
		this.triggerScheduler.stop();

		if (!this.plugin.settings.autoSyncEnabled) {
			return;
		}

		this.autoSyncPaused = false;
		this.triggerScheduler.start();
	}

	pauseAutoSync(): void {
		this.autoSyncPaused = true;
	}

	resumeAutoSync(): void {
		this.autoSyncPaused = false;
		this.sessionManager.handleAuthRecovered();
		this.triggerScheduler.scheduleManualRun();
	}

	isAutoSyncPaused(): boolean {
		return this.autoSyncPaused;
	}

	isAuthPaused(): boolean {
		return this.sessionManager.isAuthPaused();
	}

	getLastAuthError(): string | undefined {
		return this.sessionManager.getLastAuthError();
	}

	async runAutoSync(force = false): Promise<void> {
		await this.triggerScheduler.runManual(
			force || this.autoSyncPaused || this.sessionManager.isAuthPaused(),
		);
	}

	isSyncRunning(): boolean {
		return this.triggerScheduler.isSyncRunning();
	}

	teardown(): void {
		this.triggerScheduler.stop();
	}

	handleAuthRecovered(scheduleSync = true): void {
		this.sessionManager.handleAuthRecovered();
		this.networkPolicy.recordSuccess();
		if (scheduleSync && this.plugin.settings.autoSyncEnabled && !this.autoSyncPaused) {
			this.triggerScheduler.scheduleManualRun();
		}
	}

	private async performAutoSync(request: SyncRunRequest): Promise<void> {
		if ((this.autoSyncPaused || this.sessionManager.isAuthPaused()) && !request.force) {
			return;
		}
		const networkDecision = this.networkPolicy.canRun({
			force: request.force,
		});
		if (!networkDecision.allowed) {
			if (request.trigger === "manual") {
				const suffix =
					networkDecision.retryAfterMs && networkDecision.retryAfterMs > 0
						? ` Retry in ${Math.ceil(networkDecision.retryAfterMs / 1000)}s.`
						: "";
				new Notice(`${networkDecision.reason}${suffix}`);
			}
			return;
		}

		try {
			await this.syncCoordinator.run(request);
			this.networkPolicy.recordSuccess();
			if (this.sessionManager.isAuthPaused() && request.trigger === "manual") {
				new Notice("Authentication required. Sync paused.");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Auto sync failed.";
			console.warn("Auto sync failed.", error);
			this.networkPolicy.recordFailure(error);
			await this.recordSyncError(message);
			if (request.trigger === "manual") {
				new Notice(message);
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
