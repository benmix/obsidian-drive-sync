import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import type { AnyRemoteProvider } from "../contracts/provider/remote-provider";

import { registerDriveSyncAutoSyncNowCommand } from "./command-drive-sync-auto-sync-now";
import { registerDriveSyncConnectCommand } from "./command-drive-sync-connect";
import { registerDriveSyncExportDiagnosticsCommand } from "./command-drive-sync-export-diagnostics";
import { registerDriveSyncLoginCommand } from "./command-drive-sync-login";
import { registerDriveSyncLogoutCommand } from "./command-drive-sync-logout";
import { registerDriveSyncOpenSettingsCommand } from "./command-drive-sync-open-settings";
import { registerDriveSyncPauseAutoSyncCommand } from "./command-drive-sync-pause-auto-sync";
import { registerDriveSyncPlanSyncCommand } from "./command-drive-sync-plan-sync";
import { registerDriveSyncPollRemoteCommand } from "./command-drive-sync-poll-remote";
import { registerDriveSyncPreSyncCheckCommand } from "./command-drive-sync-pre-sync-check";
import { registerDriveSyncRebuildIndexCommand } from "./command-drive-sync-rebuild-index";
import { registerDriveSyncResetConnectionCommand } from "./command-drive-sync-reset-connection";
import { registerDriveSyncRestoreVaultCommand } from "./command-drive-sync-restore-vault";
import { registerDriveSyncResumeAutoSyncCommand } from "./command-drive-sync-resume-auto-sync";
import { registerDriveSyncReviewConflictsCommand } from "./command-drive-sync-review-conflicts";
import { registerDriveSyncRunPlannedSyncCommand } from "./command-drive-sync-run-planned-sync";
import { registerDriveSyncShowStatusCommand } from "./command-drive-sync-show-status";
import { registerDriveSyncSyncVaultCommand } from "./command-drive-sync-sync-vault";
import { registerDriveSyncValidateRemoteOpsCommand } from "./command-drive-sync-validate-remote-ops";
import { createCommandContext } from "./context";

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
