import { Notice } from "obsidian";

import type {
	CommandContext,
	CommandErrorOptions,
	ConnectedRemoteClient,
} from "../contracts/plugin/command-context";
import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import type { AnyRemoteProvider } from "../contracts/provider/remote-provider";
import type { DriveSyncErrorCode, ErrorCategory } from "../errors";
import { normalizeUnknownDriveSyncError, translateDriveSyncErrorUserMessage } from "../errors";
import { tr, trAny } from "../i18n";
import { RemoteAuthRequiredModal } from "../ui/auth-required-modal";

export function createCommandContext<TProvider extends AnyRemoteProvider>(
	plugin: ObsidianDriveSyncPluginApi<TProvider>,
): CommandContext<TProvider> {
	const localProvider = plugin.getLocalProvider();

	const requireScopeId = (): string | null => {
		const scopeId = plugin.getRemoteScopeId();
		if (!scopeId) {
			new Notice(tr("notice.selectRemoteFolderFirst"));
			return null;
		}
		return scopeId;
	};

	const requireConnectedRemoteClient =
		async (): Promise<ConnectedRemoteClient<TProvider> | null> => {
			const scopeId = requireScopeId();
			if (!scopeId) {
				return null;
			}
			const provider = plugin.getRemoteProvider();
			if (!plugin.getStoredProviderCredentials() && !provider.getSession()) {
				new RemoteAuthRequiredModal(plugin.app, plugin).open();
				return null;
			}

			let client;
			try {
				client = await plugin.connectRemoteClient();
			} catch (error) {
				showCommandError(error, {
					logMessage: "Failed to connect remote provider for command.",
					noticeKey: "notice.unableToConnectProvider",
					noticeParams: { provider: provider.label },
					category: "provider",
					userMessage: tr("notice.unableToConnectProvider", {
						provider: provider.label,
					}),
					userMessageKey: "error.provider.unableToConnectNamed",
				});
				return null;
			}

			plugin.handleAuthRecovered(false);
			return { provider, client, scopeId };
		};

	const runRemoteCommand = async (
		onConnected: (connection: ConnectedRemoteClient<TProvider>) => Promise<void>,
	): Promise<void> => {
		const connection = await requireConnectedRemoteClient();
		if (!connection) {
			return;
		}
		await onConnected(connection);
	};

	const showCommandError = (error: unknown, options: CommandErrorOptions): void => {
		const normalized = normalizeUnknownDriveSyncError(error, {
			code: options.code as DriveSyncErrorCode | undefined,
			category: options.category as ErrorCategory | undefined,
			retryable: options.retryable,
			userMessage: options.userMessage ?? trAny(options.noticeKey, options.noticeParams),
			userMessageKey: options.userMessageKey ?? options.noticeKey,
		});
		console.warn(options.logMessage, error);
		new Notice(translateDriveSyncErrorUserMessage(normalized, trAny));
	};

	return {
		plugin,
		localProvider,
		requireScopeId,
		requireConnectedRemoteClient,
		runRemoteCommand,
		showCommandError,
	};
}
