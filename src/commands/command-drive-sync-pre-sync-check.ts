import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { estimateSyncPlan, planSync, runPlannedSync } from "@runtime/use-cases/sync-workflows";
import { SyncPreflightModal } from "@ui/pre-sync-modal";
import { Notice } from "obsidian";

export function registerDriveSyncPreSyncCheckCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand, showCommandError } = context;
	plugin.addCommand({
		id: "drive-sync-pre-sync-check",
		name: tr("commands.preSyncCheck.name"),
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const estimate = await estimateSyncPlan(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
						{ syncStrategy: plugin.settings.syncStrategy },
					);
					new SyncPreflightModal(plugin.app, plugin, estimate, async () => {
						await planSync(plugin.app, localProvider, provider, client, scopeId, {
							syncStrategy: plugin.settings.syncStrategy,
						});
						const result = await runPlannedSync(
							plugin.app,
							localProvider,
							provider,
							client,
							scopeId,
							{ syncStrategy: plugin.settings.syncStrategy },
						);
						new Notice(
							tr("notice.executedJobsUpdatedEntries", {
								jobs: result.jobsExecuted,
								entries: result.entriesUpdated,
							}),
						);
					}).open();
				} catch (error) {
					showCommandError(error, {
						logMessage: "Pre-sync check failed.",
						noticeKey: "notice.preSyncCheckFailed",
					});
				}
			});
		},
	});
}
