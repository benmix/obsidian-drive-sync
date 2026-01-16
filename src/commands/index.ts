import { Notice } from "obsidian";
import type ProtonDriveSyncPlugin from "../main";
import { buildSdkOptions } from "../proton-drive/sdk-options";
import {
	planSync,
	pollRemoteSync,
	restoreVaultFromProtonDrive,
	runPlannedSync,
	syncVaultToProtonDrive,
} from "../proton-drive/sync";
import { exportDiagnostics } from "../sync/diagnostics";
import { ProtonDriveStatusModal } from "../ui/status-modal";
import { ProtonDriveLoginModal } from "../ui/login-modal";

export function registerCommands(plugin: ProtonDriveSyncPlugin) {
	plugin.addCommand({
		id: "protondrive-connect",
		name: "Connect to Proton Drive",
		callback: async () => {
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			const { options, error } = buildSdkOptions(
				plugin.settings.sdkOptionsJson,
				plugin.settings.sessionToken,
			);
			if (error) {
				new Notice(error);
				return;
			}

			const client = await plugin.protonDriveService.connect(options);
			if (client) {
				new Notice("Connected to Proton Drive.");
				return;
			}

			new Notice("Unable to connect to Proton Drive. Check the SDK options.");
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
			plugin.settings.sessionToken = "";
			plugin.settings.accountEmail = "";
			await plugin.saveSettings();
			plugin.protonDriveService.disconnect();
			new Notice("Signed out of Proton Drive.");
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

			const { options, error } = buildSdkOptions(
				plugin.settings.sdkOptionsJson,
				plugin.settings.sessionToken,
			);
			if (error) {
				new Notice(error);
				return;
			}

			const client = await plugin.protonDriveService.connect(options);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await planSync(plugin.app, client, plugin.settings.remoteFolderId);
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

			const { options, error } = buildSdkOptions(
				plugin.settings.sdkOptionsJson,
				plugin.settings.sessionToken,
			);
			if (error) {
				new Notice(error);
				return;
			}

			const client = await plugin.protonDriveService.connect(options);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await pollRemoteSync(
					plugin.app,
					client,
					plugin.settings.remoteFolderId,
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

			const { options, error } = buildSdkOptions(
				plugin.settings.sdkOptionsJson,
				plugin.settings.sessionToken,
			);
			if (error) {
				new Notice(error);
				return;
			}

			const client = await plugin.protonDriveService.connect(options);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			try {
				const result = await runPlannedSync(
					plugin.app,
					client,
					plugin.settings.remoteFolderId,
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

			const { options, error } = buildSdkOptions(
				plugin.settings.sdkOptionsJson,
				plugin.settings.sessionToken,
			);
			if (error) {
				new Notice(error);
				return;
			}

			const client = await plugin.protonDriveService.connect(options);
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
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			if (!plugin.settings.remoteFolderId.trim()) {
				new Notice("Set a remote folder ID in settings first.");
				return;
			}

			const { options, error } = buildSdkOptions(
				plugin.settings.sdkOptionsJson,
				plugin.settings.sessionToken,
			);
			if (error) {
				new Notice(error);
				return;
			}

			const client = await plugin.protonDriveService.connect(options);
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
		id: "protondrive-export-diagnostics",
		name: "Export Proton Drive diagnostics",
		callback: async () => {
			try {
				const path = await exportDiagnostics(plugin.app);
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
