import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import {
	estimateSyncPlan,
	planSync,
	pollRemoteSync,
	restoreVaultFromRemote,
	runPlannedSync,
	syncVaultToRemote,
} from "@runtime/use-cases/sync-workflows";
import { SyncPreflightModal } from "@ui/pre-sync-modal";
import { Notice } from "obsidian";

export function registerSyncCommands(context: CommandContext): void {
	const { plugin, localProvider, requireScopeId, runRemoteCommand, showCommandError } = context;

	plugin.addCommand({
		id: "drive-sync-pre-sync-check",
		name: tr("commands.preSyncCheck.name"),
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
					new SyncPreflightModal(plugin.app, plugin, estimate, async () => {
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
							tr("notice.executedJobsUpdatedEntries", {
								jobs: result.jobsExecuted,
								entries: result.entriesUpdated,
							}),
						);
					}).open();
				} catch (error) {
					showCommandError(error, {
						logMessage: "Pre-sync check failed.",
						noticeKey: "notice.preSyncCheckFailed",
					});
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-plan-sync",
		name: tr("commands.planSync.name"),
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
						tr("notice.plannedJobsAcrossEntries", {
							jobs: result.jobsPlanned,
							entries: result.entries,
						}),
					);
				} catch (error) {
					showCommandError(error, {
						logMessage: "Sync planning failed.",
						noticeKey: "notice.syncPlanningFailed",
					});
				}
			});
		},
	});

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
					showCommandError(error, {
						logMessage: "Planned sync failed.",
						noticeKey: "notice.plannedSyncFailed",
					});
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-auto-sync-now",
		name: tr("commands.autoSyncNow.name"),
		callback: async () => {
			if (!requireScopeId()) {
				return;
			}
			try {
				await plugin.runAutoSync();
				new Notice(tr("notice.autoSyncCompleted"));
			} catch (error) {
				showCommandError(error, {
					logMessage: "Auto sync failed.",
					noticeKey: "notice.autoSyncFailed",
				});
			}
		},
	});

	plugin.addCommand({
		id: "drive-sync-sync-vault",
		name: tr("commands.syncVault.name"),
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
					new Notice(
						tr("notice.uploadedFilesToProvider", {
							count: result.uploaded,
							provider: provider.label,
						}),
					);
				} catch (error) {
					showCommandError(error, {
						logMessage: "Vault sync failed.",
						noticeKey: "notice.vaultSyncFailed",
					});
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-restore-vault",
		name: tr("commands.restoreVault.name"),
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
					new Notice(
						tr("notice.downloadedFilesFromProvider", {
							count: result.downloaded,
							provider: provider.label,
						}),
					);
				} catch (error) {
					showCommandError(error, {
						logMessage: "Vault restore failed.",
						noticeKey: "notice.vaultRestoreFailed",
					});
				}
			});
		},
	});

	plugin.addCommand({
		id: "drive-sync-pause-auto-sync",
		name: tr("commands.pauseAutoSync.name"),
		callback: () => {
			plugin.pauseAutoSync();
			new Notice(tr("notice.autoSyncPaused"));
		},
	});

	plugin.addCommand({
		id: "drive-sync-resume-auto-sync",
		name: tr("commands.resumeAutoSync.name"),
		callback: () => {
			plugin.resumeAutoSync();
			new Notice(tr("notice.autoSyncResumed"));
		},
	});
}
