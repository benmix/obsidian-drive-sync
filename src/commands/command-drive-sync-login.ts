import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { RemoteProviderLoginModal } from "../ui/login-modal";

export function registerDriveSyncLoginCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-login",
		name: tr("commands.login.name"),
		callback: () => {
			new RemoteProviderLoginModal(plugin.app, plugin).open();
		},
	});
}
