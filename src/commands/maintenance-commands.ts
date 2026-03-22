import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { exportDiagnostics } from "@runtime/use-cases/diagnostics";
import { validateRemoteOperations } from "@runtime/use-cases/remote-validation";
import { rebuildSyncIndex } from "@runtime/use-cases/sync-workflows";
import { Notice } from "obsidian";

export function registerMaintenanceCommands(context: CommandContext): void {
	const { plugin, localProvider, runRemoteCommand, showCommandError } = context;

	plugin.addCommand({
		id: "drive-sync-validate-remote-ops",
		name: tr("commands.validateOps.name"),
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const remoteFileSystem = provider.createRemoteFileSystem(client, scopeId);
					const prefix = `__${provider.id.replace(/[^A-Za-z0-9_]+/g, "_")}_sync_validation`;
					const report = await validateRemoteOperations(remoteFileSystem, prefix);
					const failed = report.steps.filter((step) => !step.ok);
					if (failed.length === 0) {
						new Notice(tr("notice.remoteOpsValidated"));
					} else {
						new Notice(
							tr("notice.remoteValidationFailedStep", {
								step: failed[0]?.name ?? tr("notice.unknownStep"),
							}),
						);
					}
				} catch (error) {
					showCommandError(error, {
						logMessage: "Remote validation failed.",
						noticeKey: "notice.remoteValidationFailed",
					});
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-rebuild-index",
		name: tr("commands.rebuildIndex.name"),
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					await rebuildSyncIndex(plugin.app, localProvider, provider, client, scopeId, {
						syncStrategy: plugin.settings.syncStrategy,
					});
					new Notice(tr("notice.indexRebuilt"));
				} catch (error) {
					showCommandError(error, {
						logMessage: "Index rebuild failed.",
						noticeKey: "notice.indexRebuildFailed",
					});
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-export-diagnostics",
		name: tr("commands.exportDiagnostics.name"),
		callback: async () => {
			try {
				const path = await exportDiagnostics(plugin.app, plugin);
				new Notice(tr("notice.diagnosticsExportedTo", { path }));
			} catch (error) {
				showCommandError(error, {
					logMessage: "Diagnostics export failed.",
					noticeKey: "notice.diagnosticsExportFailed",
				});
			}
		},
	});
}
