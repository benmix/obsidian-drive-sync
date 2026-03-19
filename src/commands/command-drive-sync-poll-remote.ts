import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { pollRemoteSync } from "@runtime/use-cases/sync-workflows";
import { Notice } from "obsidian";

export function registerDriveSyncPollRemoteCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand, showCommandError } = context;
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
					showCommandError(error, {
						logMessage: "Remote poll failed.",
						noticeKey: "notice.remotePollFailed",
					});
				}
			});
		},
	});
}
