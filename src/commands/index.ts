import { registerAuthCommands } from "@commands/auth-commands";
import { createCommandContext } from "@commands/context";
import { registerMaintenanceCommands } from "@commands/maintenance-commands";
import { registerSyncCommands } from "@commands/sync-commands";
import { registerUiCommands } from "@commands/ui-commands";
import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-api";
import type { AnyRemoteProvider } from "@contracts/provider/remote-provider";

export function registerCommands<TProvider extends AnyRemoteProvider>(
	plugin: ObsidianDriveSyncPluginApi<TProvider>,
) {
	const context = createCommandContext(plugin);

	registerAuthCommands(context);
	registerUiCommands(context);
	registerSyncCommands(context);
	registerMaintenanceCommands(context);
}
