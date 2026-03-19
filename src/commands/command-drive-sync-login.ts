import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { openRemoteLoginModal } from "@ui/auth-required-modal";

export function registerDriveSyncLoginCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-login",
		name: tr("commands.login.name"),
		callback: () => {
			openRemoteLoginModal(plugin);
		},
	});
}
