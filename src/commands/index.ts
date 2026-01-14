import {Notice} from "obsidian";
import type ProtonDriveSyncPlugin from "../main";
import {buildSdkOptions} from "../protonDrive/sdkOptions";
import {restoreVaultFromProtonDrive, syncVaultToProtonDrive} from "../protonDrive/sync";
import {ProtonDriveLoginModal} from "../ui/loginModal";

export function registerCommands(plugin: ProtonDriveSyncPlugin) {
	plugin.addCommand({
		id: "protondrive-connect",
		name: "Connect to Proton Drive",
		callback: async () => {
			if (!plugin.settings.enableProtonDrive) {
				new Notice("Enable Proton Drive integration in settings first.");
				return;
			}

			const {options, error} = buildSdkOptions(plugin.settings.sdkOptionsJson, plugin.settings.sessionToken);
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
		}
	});

	plugin.addCommand({
		id: "protondrive-login",
		name: "Sign in to Proton Drive",
		callback: () => {
			new ProtonDriveLoginModal(plugin.app, plugin).open();
		}
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
		}
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

			const {options, error} = buildSdkOptions(plugin.settings.sdkOptionsJson, plugin.settings.sessionToken);
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
				const result = await syncVaultToProtonDrive(plugin.app, client, plugin.settings.remoteFolderId);
				new Notice(`Uploaded ${result.uploaded} files to Proton Drive.`);
			} catch (error) {
				console.warn("Vault sync failed.", error);
				new Notice("Vault sync failed. Check the console for details.");
			}
		}
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

			const {options, error} = buildSdkOptions(plugin.settings.sdkOptionsJson, plugin.settings.sessionToken);
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
				const result = await restoreVaultFromProtonDrive(plugin.app, client, plugin.settings.remoteFolderId);
				new Notice(`Downloaded ${result.downloaded} files from Proton Drive.`);
			} catch (error) {
				console.warn("Vault restore failed.", error);
				new Notice("Vault restore failed. Check the console for details.");
			}
		}
	});

	plugin.addCommand({
		id: "protondrive-reset-connection",
		name: "Reset Proton Drive connection",
		callback: () => {
			plugin.protonDriveService.disconnect();
			new Notice("Proton Drive connection reset.");
		}
	});
}
