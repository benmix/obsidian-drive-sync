import { Notice } from "obsidian";

import { type ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import type {
	AnyRemoteProvider,
	RemoteProviderClient,
	RemoteProviderSessionOf,
} from "../contracts/provider/remote-provider";
import { type SyncRunRequest } from "../contracts/sync/run-request";
import {
	createDriveSyncError,
	normalizeUnknownDriveSyncError,
	toDriveSyncErrorSummary,
	translateDriveSyncErrorUserMessage,
} from "../errors";
import { trAny } from "../i18n";
import { INTERNAL_NETWORK_POLICY_FAILURE_COOLDOWN_MS } from "../internal-config";
import { getBuiltInExcludePatterns as getBuiltInExcludePatternsUseCase } from "../sync/planner/exclude";
import { PluginDataStateStore } from "../sync/state/state-store";
import { now } from "../sync/support/utils";

import { NetworkPolicy } from "./network-policy";
import { SessionManager } from "./session-manager";
import { SyncCoordinator } from "./sync-coordinator";
import { TriggerScheduler } from "./trigger-scheduler";
import {
	clearConflictMarker as clearConflictMarkerUseCase,
	loadSyncState as loadSyncStateUseCase,
} from "./use-cases/sync-state";

export class PluginRuntime<TProvider extends AnyRemoteProvider> {
	private autoSyncPaused = false;
	private readonly sessionManager: SessionManager<TProvider>;
	private readonly syncCoordinator: SyncCoordinator<TProvider>;
	private readonly triggerScheduler: TriggerScheduler;
	private readonly networkPolicy: NetworkPolicy;

	constructor(private readonly plugin: ObsidianDriveSyncPluginApi<TProvider>) {
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

	async buildActiveRemoteSession(): Promise<RemoteProviderSessionOf<TProvider> | null> {
		return await this.sessionManager.buildActiveRemoteSession();
	}

	async connectRemoteClient(): Promise<RemoteProviderClient<TProvider>> {
		return await this.sessionManager.connectClient();
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

	getBuiltInExcludePatterns(): readonly string[] {
		return getBuiltInExcludePatternsUseCase();
	}

	async loadSyncState() {
		return await loadSyncStateUseCase();
	}

	async clearConflictMarker(path: string) {
		return await clearConflictMarkerUseCase(path);
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
				new Notice(
					translateDriveSyncErrorUserMessage(
						createDriveSyncError("AUTH_REAUTH_REQUIRED", {
							category: "auth",
						}),
						trAny,
					),
				);
			}
		} catch (error) {
			const normalized = normalizeUnknownDriveSyncError(error, {
				userMessage: "Auto sync failed.",
				userMessageKey: "notice.autoSyncFailed",
			});
			const message = translateDriveSyncErrorUserMessage(normalized, trAny);
			console.warn("Auto sync failed.", error);
			this.networkPolicy.recordFailure(normalized);
			await this.recordSyncError(normalized);
			if (request.trigger === "manual") {
				new Notice(message);
			}
		}
	}

	private async recordSyncError(error: unknown): Promise<void> {
		const summary = toDriveSyncErrorSummary(error);
		const stateStore = new PluginDataStateStore();
		const state = await stateStore.load();
		await stateStore.save({
			...state,
			lastErrorAt: now(),
			lastErrorCode: summary.code,
			lastErrorCategory: summary.category,
			lastErrorRetryable: summary.retryable,
		});
	}
}
