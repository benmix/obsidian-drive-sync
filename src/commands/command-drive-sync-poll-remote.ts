import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { pollRemoteSync } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncPollRemoteCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-poll-remote",
		name: tr("commands.pollRemote.name"),
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
					new Notice(
						tr("notice.remotePollQueuedJobs", {
							jobs: result.jobsPlanned,
						}),
					);
				} catch (error) {
					console.warn("Remote poll failed.", error);
					new Notice(tr("notice.remotePollFailed"));
				}
			});
		},
	});
}
