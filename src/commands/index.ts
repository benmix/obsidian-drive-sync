import { registerDriveSyncAutoSyncNowCommand } from "@commands/command-drive-sync-auto-sync-now";
import { registerDriveSyncConnectCommand } from "@commands/command-drive-sync-connect";
import { registerDriveSyncExportDiagnosticsCommand } from "@commands/command-drive-sync-export-diagnostics";
import { registerDriveSyncLoginCommand } from "@commands/command-drive-sync-login";
import { registerDriveSyncLogoutCommand } from "@commands/command-drive-sync-logout";
import { registerDriveSyncOpenSettingsCommand } from "@commands/command-drive-sync-open-settings";
import { registerDriveSyncPauseAutoSyncCommand } from "@commands/command-drive-sync-pause-auto-sync";
import { registerDriveSyncPlanSyncCommand } from "@commands/command-drive-sync-plan-sync";
import { registerDriveSyncPollRemoteCommand } from "@commands/command-drive-sync-poll-remote";
import { registerDriveSyncPreSyncCheckCommand } from "@commands/command-drive-sync-pre-sync-check";
import { registerDriveSyncRebuildIndexCommand } from "@commands/command-drive-sync-rebuild-index";
import { registerDriveSyncResetConnectionCommand } from "@commands/command-drive-sync-reset-connection";
import { registerDriveSyncRestoreVaultCommand } from "@commands/command-drive-sync-restore-vault";
import { registerDriveSyncResumeAutoSyncCommand } from "@commands/command-drive-sync-resume-auto-sync";
import { registerDriveSyncReviewConflictsCommand } from "@commands/command-drive-sync-review-conflicts";
import { registerDriveSyncRunPlannedSyncCommand } from "@commands/command-drive-sync-run-planned-sync";
import { registerDriveSyncShowStatusCommand } from "@commands/command-drive-sync-show-status";
import { registerDriveSyncSyncVaultCommand } from "@commands/command-drive-sync-sync-vault";
import { registerDriveSyncValidateRemoteOpsCommand } from "@commands/command-drive-sync-validate-remote-ops";
import { createCommandContext } from "@commands/context";
import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-api";
import type { AnyRemoteProvider } from "@contracts/provider/remote-provider";

export function registerCommands<TProvider extends AnyRemoteProvider>(
	plugin: ObsidianDriveSyncPluginApi<TProvider>,
) {
	const context = createCommandContext(plugin);

	registerDriveSyncConnectCommand(context);
	registerDriveSyncLoginCommand(context);
	registerDriveSyncLogoutCommand(context);
	registerDriveSyncReviewConflictsCommand(context);
	registerDriveSyncShowStatusCommand(context);
	registerDriveSyncOpenSettingsCommand(context);

	registerDriveSyncPreSyncCheckCommand(context);
	registerDriveSyncPlanSyncCommand(context);
	registerDriveSyncPollRemoteCommand(context);
	registerDriveSyncRunPlannedSyncCommand(context);
	registerDriveSyncAutoSyncNowCommand(context);
	registerDriveSyncSyncVaultCommand(context);
	registerDriveSyncRestoreVaultCommand(context);

	registerDriveSyncValidateRemoteOpsCommand(context);
	registerDriveSyncPauseAutoSyncCommand(context);
	registerDriveSyncResumeAutoSyncCommand(context);
	registerDriveSyncRebuildIndexCommand(context);
	registerDriveSyncExportDiagnosticsCommand(context);
	registerDriveSyncResetConnectionCommand(context);
}
