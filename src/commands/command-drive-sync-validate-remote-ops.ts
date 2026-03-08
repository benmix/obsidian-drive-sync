import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { validateRemoteOperations } from "../runtime/use-cases/remote-validation";

export function registerDriveSyncValidateRemoteOpsCommand(context: CommandContext) {
	const { runRemoteCommand } = context;
	context.plugin.addCommand({
		id: "drive-sync-validate-remote-ops",
		name: "Validate remote operations",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const remoteFileSystem = provider.createRemoteFileSystem(client, scopeId);
					const prefix = `__${provider.id.replace(/[^A-Za-z0-9_]+/g, "_")}_sync_validation`;
					const report = await validateRemoteOperations(remoteFileSystem, prefix);
					const failed = report.steps.filter((step) => !step.ok);
					if (failed.length === 0) {
						new Notice("Remote operations validated successfully.");
					} else {
						new Notice(
							`Remote validation failed: ${failed[0]?.name ?? "unknown step"}`,
						);
					}
				} catch (error) {
					console.warn("Remote validation failed.", error);
					new Notice("Remote validation failed. Check the console for details.");
				}
			});
		},
	});
}
