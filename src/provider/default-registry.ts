import type { LocalProvider } from "../contracts/provider/local-provider";
import { type LocalProviderId, type RemoteProviderId } from "../contracts/provider/provider-ids";
import type { RemoteProvider } from "../contracts/provider/remote-provider";

import { createObsidianLocalProvider } from "./providers/obsidian/provider";
import { createProtonDriveRemoteProvider } from "./providers/proton-drive/provider";
import { LocalProviderRegistry, RemoteProviderRegistry } from "./registry";

type RemoteProviderFactory = () => RemoteProvider;
type LocalProviderFactory = () => LocalProvider;

const REMOTE_PROVIDER_FACTORIES: Record<RemoteProviderId, RemoteProviderFactory> = {
	["proton-drive"]: () => createProtonDriveRemoteProvider(),
};

const LOCAL_PROVIDER_FACTORIES: Record<LocalProviderId, LocalProviderFactory> = {
	["obsidian-local"]: () => createObsidianLocalProvider(),
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
