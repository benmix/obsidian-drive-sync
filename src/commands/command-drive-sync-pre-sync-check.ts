import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { estimateSyncPlan, planSync, runPlannedSync } from "../runtime/use-cases/sync-workflows";
import { SyncPreflightModal } from "../ui/pre-sync-modal";

export function registerDriveSyncPreSyncCheckCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-pre-sync-check",
		name: "Pre-sync check (job counts + size estimate)",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const estimate = await estimateSyncPlan(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
						{ syncStrategy: plugin.settings.syncStrategy },
					);
					new SyncPreflightModal(plugin.app, estimate, async () => {
						await planSync(plugin.app, localProvider, provider, client, scopeId, {
							syncStrategy: plugin.settings.syncStrategy,
						});
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
					}).open();
				} catch (error) {
					console.warn("Pre-sync check failed.", error);
					new Notice("Pre-sync check failed. Check the console for details.");
				}
			});
		},
	});
}
