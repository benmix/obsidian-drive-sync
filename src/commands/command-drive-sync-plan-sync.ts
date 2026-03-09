import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { planSync } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncPlanSyncCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
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
					console.warn("Sync planning failed.", error);
					new Notice(tr("notice.syncPlanningFailed"));
				}
			});
		},
	});
}
