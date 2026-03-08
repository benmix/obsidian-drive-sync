import type { ObsidianDriveSyncPluginApi } from "./plugin-api";

type RemoteProvider = ReturnType<ObsidianDriveSyncPluginApi["getRemoteProvider"]>;
type LocalProvider = ReturnType<ObsidianDriveSyncPluginApi["getLocalProvider"]>;

export type ConnectedRemoteClient = {
	provider: RemoteProvider;
	client: unknown;
	scopeId: string;
};

export type CommandContext = {
	plugin: ObsidianDriveSyncPluginApi;
	localProvider: LocalProvider;
	requireScopeId: () => string | null;
	requireConnectedRemoteClient: () => Promise<ConnectedRemoteClient | null>;
	runRemoteCommand: (
		onConnected: (connection: ConnectedRemoteClient) => Promise<void>,
	) => Promise<void>;
};
