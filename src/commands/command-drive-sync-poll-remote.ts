import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { pollRemoteSync } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncPollRemoteCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-poll-remote",
		name: "Poll remote changes",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const result = await pollRemoteSync(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
						{ syncStrategy: plugin.settings.syncStrategy },
					);
					new Notice(`Remote poll queued ${result.jobsPlanned} jobs.`);
				} catch (error) {
					console.warn("Remote poll failed.", error);
					new Notice("Remote poll failed. Check the console for details.");
				}
			});
		},
	});
}
