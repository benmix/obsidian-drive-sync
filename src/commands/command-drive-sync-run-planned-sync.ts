import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { runPlannedSync } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncRunPlannedSyncCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-run-planned-sync",
		name: tr("commands.runPlanned.name"),
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
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
				} catch (error) {
					console.warn("Planned sync failed.", error);
					new Notice(tr("notice.plannedSyncFailed"));
				}
			});
		},
	});
}
