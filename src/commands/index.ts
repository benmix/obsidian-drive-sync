import {
	estimateSyncPlan,
	planSync,
	pollRemoteSync,
	restoreVaultFromRemote,
	runPlannedSync,
	syncVaultToRemote,
} from "../runtime/use-cases/sync-workflows";
import { buildActiveRemoteSession } from "../provider/session";
import { exportDiagnostics } from "../runtime/use-cases/diagnostics";
import { Notice } from "obsidian";
import type { ObsidianDriveSyncPluginApi } from "../plugin/contracts";
import { PluginDataStateStore } from "../sync/state/state-store";
import { RemoteProviderLoginModal } from "../ui/login-modal";
import { SyncConflictModal } from "../ui/conflict-modal";
import { SyncEngine } from "../sync/engine/sync-engine";
import { SyncPreflightModal } from "../ui/pre-sync-modal";
import { SyncStatusModal } from "../ui/status-modal";
import { validateRemoteOperations } from "../runtime/use-cases/remote-validation";

type ConnectedRemoteClient = {
	provider: ReturnType<ObsidianDriveSyncPluginApi["getRemoteProvider"]>;
	client: unknown;
};

export function registerCommands(plugin: ObsidianDriveSyncPluginApi) {
	const localProvider = plugin.getLocalProvider();

	const requireScopeId = (): string | null => {
		const scopeId = plugin.getRemoteScopeId();
		if (!scopeId) {
			new Notice("Select a remote folder in settings first.");
			return null;
		}
		return scopeId;
	};

	const requireConnectedRemoteClient = async (): Promise<ConnectedRemoteClient | null> => {
		const provider = plugin.getRemoteProvider();
		if (!plugin.getStoredProviderCredentials() && !provider.getSession()) {
			new Notice(`Sign in to ${provider.label} first.`);
			return null;
		}

		const activeSession = await buildActiveRemoteSession(plugin);
		if (!activeSession) {
			new Notice(`Sign in to ${provider.label} first.`);
			return null;
		}

		const client = await provider.connect(activeSession);
		if (!client) {
			new Notice(`Unable to connect to ${provider.label}.`);
			return null;
		}

		plugin.handleAuthRecovered(false);
		return { provider, client };
	};

	plugin.addCommand({
		id: "protondrive-pre-sync-check",
		name: "Pre-sync check (job counts + size estimate)",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}

			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			const { provider, client } = connection;
			try {
				const estimate = await estimateSyncPlan(
					plugin.app,
					localProvider,
					provider,
					client,
					scopeId,
					{
						syncStrategy: plugin.settings.syncStrategy,
					},
				);
				new SyncPreflightModal(plugin.app, estimate, async () => {
					await planSync(plugin.app, localProvider, provider, client, scopeId, {
						syncStrategy: plugin.settings.syncStrategy,
					});
					const result = await runPlannedSync(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
						{
							syncStrategy: plugin.settings.syncStrategy,
						},
					);
					new Notice(
						`Executed ${result.jobsExecuted} jobs, updated ${result.entriesUpdated} entries.`,
					);
				}).open();
			} catch (error) {
				console.warn("Pre-sync check failed.", error);
				new Notice("Pre-sync check failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-validate-remote-ops",
		name: "Validate remote operations",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}

			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			const { provider, client } = connection;
			try {
				const remoteFileSystem = provider.createRemoteFileSystem(client, scopeId);
				const prefix = `__${provider.id.replace(/[^A-Za-z0-9_]+/g, "_")}_sync_validation`;
				const report = await validateRemoteOperations(remoteFileSystem, prefix);
				const failed = report.steps.filter((step) => !step.ok);
				if (failed.length === 0) {
					new Notice("Remote operations validated successfully.");
				} else {
					new Notice(`Remote validation failed: ${failed[0]?.name ?? "unknown step"}`);
				}
			} catch (error) {
				console.warn("Remote validation failed.", error);
				new Notice("Remote validation failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-connect",
		name: "Connect remote provider",
		callback: async () => {
			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			new Notice(`Connected to ${connection.provider.label}.`);
		},
	});

	plugin.addCommand({
		id: "protondrive-login",
		name: "Sign in to remote provider",
		callback: () => {
			new RemoteProviderLoginModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "protondrive-logout",
		name: "Sign out of remote provider",
		callback: async () => {
			const provider = plugin.getRemoteProvider();
			await provider.logout();
			plugin.clearStoredRemoteSession();
			await plugin.saveSettings();
			provider.disconnect();
			new Notice(`Signed out of ${provider.label}.`);
		},
	});

	plugin.addCommand({
		id: "protondrive-review-conflicts",
		name: "Review sync conflicts",
		callback: () => {
			new SyncConflictModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "protondrive-plan-sync",
		name: "Plan remote sync",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}

			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			const { provider, client } = connection;
			try {
				const result = await planSync(
					plugin.app,
					localProvider,
					provider,
					client,
					scopeId,
					{
						syncStrategy: plugin.settings.syncStrategy,
					},
				);
				new Notice(`Planned ${result.jobsPlanned} jobs across ${result.entries} entries.`);
			} catch (error) {
				console.warn("Sync planning failed.", error);
				new Notice("Sync planning failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-poll-remote",
		name: "Poll remote changes",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}

			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			const { provider, client } = connection;
			try {
				const result = await pollRemoteSync(
					plugin.app,
					localProvider,
					provider,
					client,
					scopeId,
					{
						syncStrategy: plugin.settings.syncStrategy,
					},
				);
				new Notice(`Remote poll queued ${result.jobsPlanned} jobs.`);
			} catch (error) {
				console.warn("Remote poll failed.", error);
				new Notice("Remote poll failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-run-planned-sync",
		name: "Run planned remote sync",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}

			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			const { provider, client } = connection;
			try {
				const result = await runPlannedSync(
					plugin.app,
					localProvider,
					provider,
					client,
					scopeId,
					{
						syncStrategy: plugin.settings.syncStrategy,
					},
				);
				new Notice(
					`Executed ${result.jobsExecuted} jobs, updated ${result.entriesUpdated} entries.`,
				);
			} catch (error) {
				console.warn("Planned sync failed.", error);
				new Notice("Planned sync failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-auto-sync-now",
		name: "Run auto sync now",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}
			try {
				await plugin.runAutoSync();
				new Notice("Auto sync completed.");
			} catch (error) {
				console.warn("Auto sync failed.", error);
				new Notice("Auto sync failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-sync-vault",
		name: "Sync vault to remote",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}

			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			const { provider, client } = connection;
			try {
				const result = await syncVaultToRemote(
					plugin.app,
					localProvider,
					provider,
					client,
					scopeId,
				);
				new Notice(`Uploaded ${result.uploaded} files to ${provider.label}.`);
			} catch (error) {
				console.warn("Vault sync failed.", error);
				new Notice("Vault sync failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-restore-vault",
		name: "Restore vault from remote",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}

			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			const { provider, client } = connection;
			try {
				const result = await restoreVaultFromRemote(
					plugin.app,
					localProvider,
					provider,
					client,
					scopeId,
				);
				new Notice(`Downloaded ${result.downloaded} files from ${provider.label}.`);
			} catch (error) {
				console.warn("Vault restore failed.", error);
				new Notice("Vault restore failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-show-status",
		name: "Show sync status",
		callback: () => {
			new SyncStatusModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "protondrive-pause-auto-sync",
		name: "Pause auto sync",
		callback: () => {
			plugin.pauseAutoSync();
			new Notice("Auto sync paused.");
		},
	});

	plugin.addCommand({
		id: "protondrive-resume-auto-sync",
		name: "Resume auto sync",
		callback: () => {
			plugin.resumeAutoSync();
			new Notice("Auto sync resumed.");
		},
	});

	plugin.addCommand({
		id: "protondrive-rebuild-index",
		name: "Rebuild sync index",
		callback: async () => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return;
			}

			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}

			const { provider, client } = connection;
			try {
				const localFileSystem = localProvider.createLocalFileSystem(plugin.app);
				const remoteFileSystem = provider.createRemoteFileSystem(client, scopeId);
				const stateStore = new PluginDataStateStore();
				const engine = new SyncEngine(localFileSystem, remoteFileSystem, stateStore, {
					syncStrategy: plugin.settings.syncStrategy,
				});
				await engine.load();
				await engine.rebuildIndex();
				new Notice("Sync index rebuilt.");
			} catch (error) {
				console.warn("Index rebuild failed.", error);
				new Notice("Index rebuild failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-export-diagnostics",
		name: "Export diagnostics",
		callback: async () => {
			try {
				const path = await exportDiagnostics(plugin.app, plugin);
				new Notice(`Diagnostics exported to ${path}.`);
			} catch (error) {
				console.warn("Diagnostics export failed.", error);
				new Notice("Diagnostics export failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-reset-connection",
		name: "Reset remote connection",
		callback: () => {
			const provider = plugin.getRemoteProvider();
			provider.disconnect();
			new Notice(`${provider.label} connection reset.`);
		},
	});
}
