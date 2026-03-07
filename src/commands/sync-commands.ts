import {
	estimateSyncPlan,
	planSync,
	pollRemoteSync,
	restoreVaultFromRemote,
	runPlannedSync,
	syncVaultToRemote,
} from "../runtime/use-cases/sync-workflows";
import type { CommandContext } from "./context";
import { Notice } from "obsidian";
import { SyncPreflightModal } from "../ui/pre-sync-modal";

export function registerSyncCommands(context: CommandContext) {
	const { plugin, localProvider, requireScopeId, runRemoteCommand } = context;

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

	plugin.addCommand({
		id: "drive-sync-auto-sync-now",
		name: "Run auto sync now",
		callback: async () => {
			if (!requireScopeId()) {
				return;
			}
			try {
				await plugin.runAutoSync();
				new Notice("Auto sync completed.");
			} catch (error) {
				console.warn("Auto sync failed.", error);
				new Notice("Auto sync failed. Check the console for details.");
			}
		},
	});

	plugin.addCommand({
		id: "drive-sync-sync-vault",
		name: "Sync vault to remote",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const result = await syncVaultToRemote(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
					);
					new Notice(`Uploaded ${result.uploaded} files to ${provider.label}.`);
				} catch (error) {
					console.warn("Vault sync failed.", error);
					new Notice("Vault sync failed. Check the console for details.");
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-restore-vault",
		name: "Restore vault from remote",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const result = await restoreVaultFromRemote(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
					);
					new Notice(`Downloaded ${result.downloaded} files from ${provider.label}.`);
				} catch (error) {
					console.warn("Vault restore failed.", error);
					new Notice("Vault restore failed. Check the console for details.");
				}
			});
		},
	});
}
