import type { CommandContext } from "../contracts/plugin/command-context";
import { RemoteProviderLoginModal } from "../ui/login-modal";

export function registerDriveSyncLoginCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-login",
		name: "Sign in to remote provider",
		callback: () => {
			new RemoteProviderLoginModal(plugin.app, plugin).open();
		},
	});
}
