import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { planSync } from "@runtime/use-cases/sync-workflows";
import { Notice } from "obsidian";

export function registerDriveSyncPlanSyncCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand, showCommandError } = context;
	plugin.addCommand({
		id: "drive-sync-plan-sync",
		name: tr("commands.planSync.name"),
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const result = await planSync(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
						{ syncStrategy: plugin.settings.syncStrategy },
					);
					new Notice(
						tr("notice.plannedJobsAcrossEntries", {
							jobs: result.jobsPlanned,
							entries: result.entries,
						}),
					);
				} catch (error) {
					showCommandError(error, {
						logMessage: "Sync planning failed.",
						noticeKey: "notice.syncPlanningFailed",
					});
				}
			});
		},
	});
}
