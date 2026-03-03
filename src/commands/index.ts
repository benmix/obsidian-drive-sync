import {
	estimateSyncPlan,
	planSync,
	pollRemoteSync,
	restoreVaultFromProtonDrive,
	runPlannedSync,
	syncVaultToProtonDrive,
} from "../proton-drive/sync";
import { exportDiagnostics } from "../sync/diagnostics";
import { Notice } from "obsidian";
import { ObsidianLocalFs } from "../sync/local-fs";
import { PluginDataStateStore } from "../sync/state-store";
import { ProtonDriveConflictModal } from "../ui/conflict-modal";
import { ProtonDriveLoginModal } from "../ui/login-modal";
import { ProtonDrivePreSyncModal } from "../ui/pre-sync-modal";
import { ProtonDriveRemoteFs } from "../sync/remote-fs";
import { ProtonDriveStatusModal } from "../ui/status-modal";
import type ProtonDriveSyncPlugin from "../main";
import type { ProtonSession } from "../proton-drive/sdk-session";
import { SyncEngine } from "../sync/sync-engine";
import { validateRemoteOperations } from "../proton-drive/remote-validation";

export function registerCommands(plugin: ProtonDriveSyncPlugin) {
	const buildActiveSession = async (): Promise<ProtonSession | null> => {
		const saved = plugin.settings.protonSession;
		let session = plugin.authService.getSession();
		if (!session && saved) {
			try {
				session = await plugin.authService.restore(saved);
				plugin.settings.hasAuthSession = true;
				await plugin.saveSettings();
			} catch (error) {
				console.warn("Failed to restore Proton session.", error);
				plugin.settings.protonSession = undefined;
				plugin.settings.accountEmail = "";
				plugin.settings.hasAuthSession = false;
				await plugin.saveSettings();
				return null;
			}
		}
		if (!session) {
			return null;
		}
		const activeSession = {
			...session,
		} as ProtonSession;
		activeSession.onTokenRefresh = async () => {
			try {
				await plugin.authService.refreshToken();
				const refreshedSession = plugin.authService.getSession();
				if (refreshedSession) {
					Object.assign(activeSession, refreshedSession);
				}
				plugin.settings.protonSession = plugin.authService.getReusableCredentials();
				plugin.settings.hasAuthSession = true;
				await plugin.saveSettings();
			} catch (refreshError) {
				console.warn("Failed to refresh Proton session.", refreshError);
				plugin.settings.hasAuthSession = false;
				await plugin.saveSettings();
			}
		};
		return activeSession;
	};

	plugin.addCommand({
		id: "protondrive-pre-sync-check",
		name: "Pre-sync check (job counts + size estimate)",
		callback: async () => {
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const estimate = await estimateSyncPlan(
					plugin.app,
					client,
					plugin.settings.remoteFolderId,
					{
						conflictStrategy: plugin.settings.conflictStrategy,
					},
				);
				new ProtonDrivePreSyncModal(plugin.app, estimate, async () => {
					await planSync(plugin.app, client, plugin.settings.remoteFolderId, {
						conflictStrategy: plugin.settings.conflictStrategy,
					});
					const result = await runPlannedSync(
						plugin.app,
						client,
						plugin.settings.remoteFolderId,
						{
							conflictStrategy: plugin.settings.conflictStrategy,
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
		name: "Validate Proton Drive remote operations",
		callback: async () => {
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const report = await validateRemoteOperations(
					client,
					plugin.settings.remoteFolderId,
				);
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
		name: "Connect to Proton Drive",
		callback: async () => {
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (client) {
				new Notice("Connected to Proton Drive.");
				return;
			}

			new Notice("Unable to connect to Proton Drive.");
		},
	});

	plugin.addCommand({
		id: "protondrive-login",
		name: "Sign in to Proton Drive",
		callback: () => {
			new ProtonDriveLoginModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "protondrive-logout",
		name: "Sign out of Proton Drive",
		callback: async () => {
			await plugin.authService.logout();
			plugin.settings.protonSession = undefined;
			plugin.settings.accountEmail = "";
			plugin.settings.hasAuthSession = false;
			await plugin.saveSettings();
			plugin.protonDriveService.disconnect();
			new Notice("Signed out of Proton Drive.");
		},
	});

	plugin.addCommand({
		id: "protondrive-review-conflicts",
		name: "Review Proton Drive conflicts",
		callback: () => {
			new ProtonDriveConflictModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "protondrive-plan-sync",
		name: "Plan Proton Drive sync",
		callback: async () => {
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await planSync(plugin.app, client, plugin.settings.remoteFolderId, {
					conflictStrategy: plugin.settings.conflictStrategy,
				});
				new Notice(`Planned ${result.jobsPlanned} jobs across ${result.entries} entries.`);
			} catch (error) {
				console.warn("Sync planning failed.", error);
				new Notice("Sync planning failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-poll-remote",
		name: "Poll Proton Drive changes",
		callback: async () => {
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await pollRemoteSync(
					plugin.app,
					client,
					plugin.settings.remoteFolderId,
					{
						conflictStrategy: plugin.settings.conflictStrategy,
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
		name: "Run planned Proton Drive sync",
		callback: async () => {
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await runPlannedSync(
					plugin.app,
					client,
					plugin.settings.remoteFolderId,
					{
						conflictStrategy: plugin.settings.conflictStrategy,
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
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
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
		name: "Sync vault to Proton Drive",
		callback: async () => {
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await syncVaultToProtonDrive(
					plugin.app,
					client,
					plugin.settings.remoteFolderId,
				);
				new Notice(`Uploaded ${result.uploaded} files to Proton Drive.`);
			} catch (error) {
				console.warn("Vault sync failed.", error);
				new Notice("Vault sync failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-restore-vault",
		name: "Restore vault from Proton Drive",
		callback: async () => {
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await restoreVaultFromProtonDrive(
					plugin.app,
					client,
					plugin.settings.remoteFolderId,
				);
				new Notice(`Downloaded ${result.downloaded} files from Proton Drive.`);
			} catch (error) {
				console.warn("Vault restore failed.", error);
				new Notice("Vault restore failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "protondrive-show-status",
		name: "Show Proton Drive sync status",
		callback: () => {
			new ProtonDriveStatusModal(plugin.app, plugin).open();
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
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = await buildActiveSession();
			if (!activeSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const localFs = new ObsidianLocalFs(plugin.app);
				const remoteFs = new ProtonDriveRemoteFs(client, plugin.settings.remoteFolderId);
				const stateStore = new PluginDataStateStore();
				const engine = new SyncEngine(localFs, remoteFs, stateStore, {
					conflictStrategy: plugin.settings.conflictStrategy,
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
		name: "Export Proton Drive diagnostics",
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
		name: "Reset Proton Drive connection",
		callback: () => {
			plugin.protonDriveService.disconnect();
			new Notice("Proton Drive connection reset.");
		},
	});
}
