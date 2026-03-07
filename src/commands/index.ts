import { createCommandContext } from "./context";
import type { ObsidianDriveSyncPluginApi } from "../plugin/contracts";
import { registerMaintenanceCommands } from "./maintenance-commands";
import { registerSyncCommands } from "./sync-commands";
import { registerUiSessionCommands } from "./ui-session-commands";

export function registerCommands(plugin: ObsidianDriveSyncPluginApi) {
	const context = createCommandContext(plugin);
	registerUiSessionCommands(context);
	registerSyncCommands(context);
	registerMaintenanceCommands(context);
}
