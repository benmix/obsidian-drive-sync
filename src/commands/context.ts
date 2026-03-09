import { Notice } from "obsidian";

import type { CommandContext, ConnectedRemoteClient } from "../contracts/plugin/command-context";
import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import { tr } from "../i18n";

export function createCommandContext(plugin: ObsidianDriveSyncPluginApi): CommandContext {
	const localProvider = plugin.getLocalProvider();

	const requireScopeId = (): string | null => {
		const scopeId = plugin.getRemoteScopeId();
		if (!scopeId) {
			new Notice(tr("notice.selectRemoteFolderFirst"));
			return null;
		}
		return scopeId;
	};

	const requireConnectedRemoteClient = async (): Promise<ConnectedRemoteClient | null> => {
		const scopeId = requireScopeId();
		if (!scopeId) {
			return null;
		}
		const provider = plugin.getRemoteProvider();
		if (!plugin.getStoredProviderCredentials() && !provider.getSession()) {
			new Notice(
				tr("notice.signInToProviderFirst", {
					provider: provider.label,
				}),
			);
			return null;
		}

		const client = await plugin.connectRemoteClient();
		if (!client) {
			new Notice(
				tr("notice.unableToConnectProvider", {
					provider: provider.label,
				}),
			);
			return null;
		}

		plugin.handleAuthRecovered(false);
		return { provider, client, scopeId };
	};

	const runRemoteCommand = async (
		onConnected: (connection: ConnectedRemoteClient) => Promise<void>,
	): Promise<void> => {
		const connection = await requireConnectedRemoteClient();
		if (!connection) {
			return;
		}
		await onConnected(connection);
	};

	return {
		plugin,
		localProvider,
		requireScopeId,
		requireConnectedRemoteClient,
		runRemoteCommand,
	};
}
