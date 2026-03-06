import {
	DEFAULT_LOCAL_PROVIDER_ID,
	DEFAULT_REMOTE_PROVIDER_ID,
	type LocalProvider,
	type LocalProviderId,
	type RemoteProvider,
	type RemoteProviderId,
} from "./contracts";
import { LocalProviderRegistry, RemoteProviderRegistry } from "./registry";
import { createObsidianLocalProvider } from "./providers/obsidian/provider";
import { createProtonDriveRemoteProvider } from "./providers/proton-drive/provider";

type RemoteProviderFactory = () => RemoteProvider;
type LocalProviderFactory = () => LocalProvider;

const REMOTE_PROVIDER_FACTORIES: Record<RemoteProviderId, RemoteProviderFactory> = {
	[DEFAULT_REMOTE_PROVIDER_ID]: () => createProtonDriveRemoteProvider(),
};
const LOCAL_PROVIDER_FACTORIES: Record<LocalProviderId, LocalProviderFactory> = {
	[DEFAULT_LOCAL_PROVIDER_ID]: () => createObsidianLocalProvider(),
};

export function createRemoteProviderRegistry(
	activeProviderId: RemoteProviderId,
): RemoteProviderRegistry {
	const providerId = activeProviderId.trim();
	const providerFactory = REMOTE_PROVIDER_FACTORIES[providerId];
	if (!providerFactory) {
		throw new Error(`Unsupported remote provider: ${providerId}`);
	}
	const registry = new RemoteProviderRegistry();
	registry.register(providerFactory());
	return registry;
}

export function createLocalProviderRegistry(
	activeProviderId: LocalProviderId,
): LocalProviderRegistry {
	const providerId = activeProviderId.trim();
	const providerFactory = LOCAL_PROVIDER_FACTORIES[providerId];
	if (!providerFactory) {
		throw new Error(`Unsupported local provider: ${providerId}`);
	}
	const registry = new LocalProviderRegistry();
	registry.register(providerFactory());
	return registry;
}
