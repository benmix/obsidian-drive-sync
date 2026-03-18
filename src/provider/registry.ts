import type { LocalProvider } from "../contracts/provider/local-provider";
import type { LocalProviderId, RemoteProviderId } from "../contracts/provider/provider-ids";
import type { AnyRemoteProvider } from "../contracts/provider/remote-provider";
import { createDriveSyncError } from "../errors";

export class RemoteProviderRegistry<TProvider extends AnyRemoteProvider = AnyRemoteProvider> {
	private readonly providers = new Map<RemoteProviderId, TProvider>();

	constructor(initialProviders: TProvider[] = []) {
		for (const provider of initialProviders) {
			this.register(provider);
		}
	}

	register(provider: TProvider): void {
		this.providers.set(provider.id, provider);
	}

	get(providerId: RemoteProviderId): TProvider {
		const provider = this.providers.get(providerId);
		if (provider) {
			return provider;
		}
		throw createDriveSyncError("CONFIG_PROVIDER_MISSING", {
			category: "config",
			userMessage: "Selected provider is not available.",
			userMessageKey: "error.config.providerMissing",
			debugMessage: `Remote provider is not registered: ${providerId}`,
			details: { providerId, providerType: "remote" },
		});
	}

	list(): TProvider[] {
		return [...this.providers.values()];
	}
}

export class LocalProviderRegistry {
	private readonly providers = new Map<LocalProviderId, LocalProvider>();

	constructor(initialProviders: LocalProvider[] = []) {
		for (const provider of initialProviders) {
			this.register(provider);
		}
	}

	register(provider: LocalProvider): void {
		this.providers.set(provider.id, provider);
	}

	get(providerId: LocalProviderId): LocalProvider {
		const provider = this.providers.get(providerId);
		if (provider) {
			return provider;
		}
		throw createDriveSyncError("CONFIG_PROVIDER_MISSING", {
			category: "config",
			userMessage: "Selected provider is not available.",
			userMessageKey: "error.config.providerMissing",
			debugMessage: `Local provider is not registered: ${providerId}`,
			details: { providerId, providerType: "local" },
		});
	}

	list(): LocalProvider[] {
		return [...this.providers.values()];
	}
}
