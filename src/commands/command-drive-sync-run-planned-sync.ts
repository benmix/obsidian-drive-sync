import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { runPlannedSync } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncRunPlannedSyncCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-run-planned-sync",
		name: "Run planned remote sync",
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
						`Executed ${result.jobsExecuted} jobs, updated ${result.entriesUpdated} entries.`,
					);
				} catch (error) {
					console.warn("Planned sync failed.", error);
					new Notice("Planned sync failed. Check the console for details.");
				}
			});
		},
	});
}
