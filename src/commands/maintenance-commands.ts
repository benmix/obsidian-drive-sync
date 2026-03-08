import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { exportDiagnostics } from "../runtime/use-cases/diagnostics";
import { validateRemoteOperations } from "../runtime/use-cases/remote-validation";
import { rebuildSyncIndex } from "../runtime/use-cases/sync-workflows";

export function registerMaintenanceCommands(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;

	plugin.addCommand({
		id: "drive-sync-validate-remote-ops",
		name: "Validate remote operations",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const remoteFileSystem = provider.createRemoteFileSystem(client, scopeId);
					const prefix = `__${provider.id.replace(/[^A-Za-z0-9_]+/g, "_")}_sync_validation`;
					const report = await validateRemoteOperations(remoteFileSystem, prefix);
					const failed = report.steps.filter((step) => !step.ok);
					if (failed.length === 0) {
						new Notice("Remote operations validated successfully.");
					} else {
						new Notice(
							`Remote validation failed: ${failed[0]?.name ?? "unknown step"}`,
						);
					}
				} catch (error) {
					console.warn("Remote validation failed.", error);
					new Notice("Remote validation failed. Check the console for details.");
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-pause-auto-sync",
		name: "Pause auto sync",
		callback: () => {
			plugin.pauseAutoSync();
			new Notice("Auto sync paused.");
		},
	});

	plugin.addCommand({
		id: "drive-sync-resume-auto-sync",
		name: "Resume auto sync",
		callback: () => {
			plugin.resumeAutoSync();
			new Notice("Auto sync resumed.");
		},
	});

	plugin.addCommand({
		id: "drive-sync-rebuild-index",
		name: "Rebuild sync index",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					await rebuildSyncIndex(plugin.app, localProvider, provider, client, scopeId, {
						syncStrategy: plugin.settings.syncStrategy,
					});
					new Notice("Sync index rebuilt.");
				} catch (error) {
					console.warn("Index rebuild failed.", error);
					new Notice("Index rebuild failed. Check the console for details.");
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-export-diagnostics",
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
		id: "drive-sync-reset-connection",
		name: "Reset remote connection",
		callback: () => {
			const provider = plugin.getRemoteProvider();
			provider.disconnect();
			new Notice(`${provider.label} connection reset.`);
		},
	});
}
