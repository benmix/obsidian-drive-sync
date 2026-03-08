import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { planSync } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncPlanSyncCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-plan-sync",
		name: "Plan remote sync",
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
						`Planned ${result.jobsPlanned} jobs across ${result.entries} entries.`,
					);
				} catch (error) {
					console.warn("Sync planning failed.", error);
					new Notice("Sync planning failed. Check the console for details.");
				}
			});
		},
	});
}
