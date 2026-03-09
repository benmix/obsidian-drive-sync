import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { validateRemoteOperations } from "../runtime/use-cases/remote-validation";

export function registerDriveSyncValidateRemoteOpsCommand(
	context: CommandContext,
) {
	const { runRemoteCommand } = context;
	context.plugin.addCommand({
		id: "drive-sync-validate-remote-ops",
		name: tr("commands.validateOps.name"),
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const remoteFileSystem = provider.createRemoteFileSystem(
						client,
						scopeId,
					);
					const prefix = `__${provider.id.replace(/[^A-Za-z0-9_]+/g, "_")}_sync_validation`;
					const report = await validateRemoteOperations(
						remoteFileSystem,
						prefix,
					);
					const failed = report.steps.filter((step) => !step.ok);
					if (failed.length === 0) {
						new Notice(tr("notice.remoteOpsValidated"));
					} else {
						new Notice(
							tr("notice.remoteValidationFailedStep", {
								step:
									failed[0]?.name ?? tr("notice.unknownStep"),
							}),
						);
					}
				} catch (error) {
					console.warn("Remote validation failed.", error);
					new Notice(tr("notice.remoteValidationFailed"));
				}
			});
		},
	});
}
