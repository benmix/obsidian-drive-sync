import type { LocalProvider } from "@contracts/provider/local-provider";
import { type LocalProviderId, type RemoteProviderId } from "@contracts/provider/provider-ids";
import type { AnyRemoteProvider } from "@contracts/provider/remote-provider";
import { createDriveSyncError } from "@errors";
import { createObsidianLocalProvider } from "@provider/providers/obsidian/provider";
import { createProtonDriveRemoteProvider } from "@provider/providers/proton-drive/provider";
import { LocalProviderRegistry, RemoteProviderRegistry } from "@provider/registry";

type LocalProviderFactory = () => LocalProvider;

const REMOTE_PROVIDER_FACTORIES = {
	["proton-drive"]: () => createProtonDriveRemoteProvider(),
} satisfies Record<RemoteProviderId, () => AnyRemoteProvider>;

export type RegisteredRemoteProvider = ReturnType<
	(typeof REMOTE_PROVIDER_FACTORIES)[keyof typeof REMOTE_PROVIDER_FACTORIES]
>;

const LOCAL_PROVIDER_FACTORIES: Record<LocalProviderId, LocalProviderFactory> = {
	["obsidian-local"]: () => createObsidianLocalProvider(),
};

export function createRemoteProviderRegistry(): RemoteProviderRegistry<RegisteredRemoteProvider> {
	const registry = new RemoteProviderRegistry<RegisteredRemoteProvider>();
	for (const providerFactory of Object.values(REMOTE_PROVIDER_FACTORIES)) {
		registry.register(providerFactory());
	}
	return registry;
}

export function createLocalProviderRegistry(
	activeProviderId: LocalProviderId,
): LocalProviderRegistry {
	const providerId = activeProviderId.trim();
	const providerFactory = LOCAL_PROVIDER_FACTORIES[providerId];
	if (!providerFactory) {
		throw createDriveSyncError("CONFIG_PROVIDER_MISSING", {
			category: "config",
			userMessage: "Selected provider is not available.",
			userMessageKey: "error.config.providerMissing",
			debugMessage: `Unsupported local provider: ${providerId}`,
			details: { providerId, providerType: "local" },
		});
	}
	const registry = new LocalProviderRegistry();
	registry.register(providerFactory());
	return registry;
}
