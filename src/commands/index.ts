import { Notice } from "obsidian";
import type ProtonDriveSyncPlugin from "../main";
import {
	planSync,
	pollRemoteSync,
	restoreVaultFromProtonDrive,
	runPlannedSync,
	syncVaultToProtonDrive,
} from "../proton-drive/sync";
import { exportDiagnostics } from "../sync/diagnostics";
import { ObsidianLocalFs } from "../sync/local-fs";
import { ProtonDriveRemoteFs } from "../sync/remote-fs";
import { SyncEngine } from "../sync/sync-engine";
import { PluginDataStateStore } from "../sync/state-store";
import { ProtonDriveStatusModal } from "../ui/status-modal";
import { ProtonDriveLoginModal } from "../ui/login-modal";
import { ProtonDriveConflictModal } from "../ui/conflict-modal";

export function registerCommands(plugin: ProtonDriveSyncPlugin) {
	plugin.addCommand({
		id: "protondrive-connect",
		name: "Connect to Proton Drive",
		callback: async () => {
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = {
				...(plugin.authService.getSession() ?? plugin.settings.protonSession),
			} as unknown as import("../proton-drive/sdk-session").ProtonSession;
			activeSession.onTokenRefresh = async () => {
				try {
					await plugin.authService.refreshToken();
					const refreshedSession = plugin.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					plugin.settings.protonSession =
						plugin.authService.getReusableCredentials() as unknown as Record<
							string,
							unknown
						>;
					plugin.settings.hasAuthSession = true;
					await plugin.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					plugin.settings.hasAuthSession = false;
					await plugin.saveSettings();
				}
			};
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
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Set a remote folder ID in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = {
				...(plugin.authService.getSession() ?? plugin.settings.protonSession),
			} as unknown as import("../proton-drive/sdk-session").ProtonSession;
			activeSession.onTokenRefresh = async () => {
				try {
					await plugin.authService.refreshToken();
					const refreshedSession = plugin.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					plugin.settings.protonSession =
						plugin.authService.getReusableCredentials() as unknown as Record<
							string,
							unknown
						>;
					plugin.settings.hasAuthSession = true;
					await plugin.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					plugin.settings.hasAuthSession = false;
					await plugin.saveSettings();
				}
			};
			const client = await plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await planSync(
					plugin.app,
					client,
					plugin.settings.remoteFolderId,
					plugin,
					{
						excludePatterns: plugin.settings.excludePatterns,
						conflictStrategy: plugin.settings.conflictStrategy,
						maxConcurrentJobs: plugin.settings.maxConcurrentJobs,
						maxRetryAttempts: plugin.settings.maxRetryAttempts,
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
		name: "Poll Proton Drive changes",
		callback: async () => {
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Set a remote folder ID in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = {
				...(plugin.authService.getSession() ?? plugin.settings.protonSession),
			} as unknown as import("../proton-drive/sdk-session").ProtonSession;
			activeSession.onTokenRefresh = async () => {
				try {
					await plugin.authService.refreshToken();
					const refreshedSession = plugin.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					plugin.settings.protonSession =
						plugin.authService.getReusableCredentials() as unknown as Record<
							string,
							unknown
						>;
					plugin.settings.hasAuthSession = true;
					await plugin.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					plugin.settings.hasAuthSession = false;
					await plugin.saveSettings();
				}
			};
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
					plugin,
					{
						excludePatterns: plugin.settings.excludePatterns,
						conflictStrategy: plugin.settings.conflictStrategy,
						maxConcurrentJobs: plugin.settings.maxConcurrentJobs,
						maxRetryAttempts: plugin.settings.maxRetryAttempts,
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
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Set a remote folder ID in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = {
				...(plugin.authService.getSession() ?? plugin.settings.protonSession),
			} as unknown as import("../proton-drive/sdk-session").ProtonSession;
			activeSession.onTokenRefresh = async () => {
				try {
					await plugin.authService.refreshToken();
					const refreshedSession = plugin.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					plugin.settings.protonSession =
						plugin.authService.getReusableCredentials() as unknown as Record<
							string,
							unknown
						>;
					plugin.settings.hasAuthSession = true;
					await plugin.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					plugin.settings.hasAuthSession = false;
					await plugin.saveSettings();
				}
			};
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
					plugin,
					{
						excludePatterns: plugin.settings.excludePatterns,
						conflictStrategy: plugin.settings.conflictStrategy,
						maxConcurrentJobs: plugin.settings.maxConcurrentJobs,
						maxRetryAttempts: plugin.settings.maxRetryAttempts,
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
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}
			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Set a remote folder ID in settings first.");
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
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Set a remote folder ID in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = {
				...(plugin.authService.getSession() ?? plugin.settings.protonSession),
			} as unknown as import("../proton-drive/sdk-session").ProtonSession;
			activeSession.onTokenRefresh = async () => {
				try {
					await plugin.authService.refreshToken();
					const refreshedSession = plugin.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					plugin.settings.protonSession =
						plugin.authService.getReusableCredentials() as unknown as Record<
							string,
							unknown
						>;
					plugin.settings.hasAuthSession = true;
					await plugin.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					plugin.settings.hasAuthSession = false;
					await plugin.saveSettings();
				}
			};
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
					{ excludePatterns: plugin.settings.excludePatterns },
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
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Set a remote folder ID in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = {
				...(plugin.authService.getSession() ?? plugin.settings.protonSession),
			} as unknown as import("../proton-drive/sdk-session").ProtonSession;
			activeSession.onTokenRefresh = async () => {
				try {
					await plugin.authService.refreshToken();
					const refreshedSession = plugin.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					plugin.settings.protonSession =
						plugin.authService.getReusableCredentials() as unknown as Record<
							string,
							unknown
						>;
					plugin.settings.hasAuthSession = true;
					await plugin.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					plugin.settings.hasAuthSession = false;
					await plugin.saveSettings();
				}
			};
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
					{ excludePatterns: plugin.settings.excludePatterns },
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
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Set a remote folder ID in settings first.");
				return;
			}
			if (!plugin.settings.protonSession || !plugin.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const activeSession = {
				...(plugin.authService.getSession() ?? plugin.settings.protonSession),
			} as unknown as import("../proton-drive/sdk-session").ProtonSession;
			activeSession.onTokenRefresh = async () => {
				try {
					await plugin.authService.refreshToken();
					const refreshedSession = plugin.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					plugin.settings.protonSession =
						plugin.authService.getReusableCredentials() as unknown as Record<
							string,
							unknown
						>;
					plugin.settings.hasAuthSession = true;
					await plugin.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					plugin.settings.hasAuthSession = false;
					await plugin.saveSettings();
				}
			};
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
					maxConcurrentJobs: plugin.settings.maxConcurrentJobs,
					excludePatterns: plugin.settings.excludePatterns,
					conflictStrategy: plugin.settings.conflictStrategy,
					maxRetryAttempts: plugin.settings.maxRetryAttempts,
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
