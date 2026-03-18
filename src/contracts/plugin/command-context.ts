import type { LocalProvider } from "../provider/local-provider";
import type { AnyRemoteProvider, RemoteProviderClient } from "../provider/remote-provider";

import type { ObsidianDriveSyncPluginApi } from "./plugin-api";

export type ConnectedRemoteClient<TProvider extends AnyRemoteProvider = AnyRemoteProvider> = {
	provider: TProvider;
	client: RemoteProviderClient<TProvider>;
	scopeId: string;
};

export type CommandErrorOptions = {
	logMessage: string;
	noticeKey: string;
	noticeParams?: Record<string, string | number | boolean>;
	code?: string;
	category?: string;
	retryable?: boolean;
	userMessage?: string;
	userMessageKey?: string;
};

export type CommandContext<TProvider extends AnyRemoteProvider = AnyRemoteProvider> = {
	plugin: ObsidianDriveSyncPluginApi<TProvider>;
	localProvider: LocalProvider;
	requireScopeId: () => string | null;
	requireConnectedRemoteClient: () => Promise<ConnectedRemoteClient<TProvider> | null>;
	runRemoteCommand: (
		onConnected: (connection: ConnectedRemoteClient<TProvider>) => Promise<void>,
	) => Promise<void>;
	showCommandError: (error: unknown, options: CommandErrorOptions) => void;
};
