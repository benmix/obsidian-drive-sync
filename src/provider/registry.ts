import type { LocalProvider, LocalProviderId, RemoteProvider, RemoteProviderId } from "./contracts";

export class RemoteProviderRegistry {
	private readonly providers = new Map<RemoteProviderId, RemoteProvider>();

	constructor(initialProviders: RemoteProvider[] = []) {
		for (const provider of initialProviders) {
			this.register(provider);
		}
	}

	register(provider: RemoteProvider): void {
		this.providers.set(provider.id, provider);
	}

	get(providerId: RemoteProviderId): RemoteProvider {
		const provider = this.providers.get(providerId);
		if (provider) {
			return provider;
		}
		throw new Error(`Remote provider is not registered: ${providerId}`);
	}

	list(): RemoteProvider[] {
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
		throw new Error(`Local provider is not registered: ${providerId}`);
	}

	list(): LocalProvider[] {
		return [...this.providers.values()];
	}
}
