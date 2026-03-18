import { MemoryCache, ProtonDriveClient } from "@protontech/drive-sdk";
import { Notice } from "obsidian";

import type { ProtonDriveConnectedClient } from "../../../../contracts/provider/proton/drive-provider";
import type { ProtonSession } from "../../../../contracts/provider/proton/sdk-session";

import { buildSdkSessionClient } from "./sdk-session";

export class ProtonDriveService {
	private client: ProtonDriveConnectedClient | null = null;
	private connecting: Promise<ProtonDriveConnectedClient | null> | null = null;
	private latestEventIds = new Map<string, string>();

	async connect(
		session: ProtonSession,
		onTokenRefresh?: () => Promise<void>,
	): Promise<ProtonDriveConnectedClient | null> {
		if (this.client) {
			return this.client;
		}

		if (this.connecting) {
			return this.connecting;
		}

		this.connecting = this.createClient(session, onTokenRefresh).finally(() => {
			this.connecting = null;
		});

		try {
			this.client = await this.connecting;
			return this.client;
		} catch (error) {
			console.warn("Failed to connect to Proton Drive.", error);
			new Notice("Unable to connect to Proton Drive.");
			this.client = null;
			return null;
		}
	}

	getClient(): ProtonDriveConnectedClient | null {
		return this.client;
	}

	disconnect() {
		this.client = null;
		this.latestEventIds.clear();
	}

	private async createClient(
		session: ProtonSession,
		onTokenRefresh?: () => Promise<void>,
	): Promise<ProtonDriveConnectedClient | null> {
		const { httpClient, account, openPGPCryptoModule, srpModule, telemetry } =
			await buildSdkSessionClient(session, onTokenRefresh);

		const sdk = new ProtonDriveClient({
			httpClient,
			entitiesCache: new MemoryCache(),
			cryptoCache: new MemoryCache(),
			account,
			openPGPCryptoModule,
			srpModule,
			telemetry,
			latestEventIdProvider: {
				getLatestEventId: (eventScopeId) => this.latestEventIds.get(eventScopeId) ?? null,
			},
		});
		return {
			sdk,
			getLatestEventId: (eventScopeId: string) =>
				this.latestEventIds.get(eventScopeId) ?? null,
			setLatestEventId: (eventScopeId: string, eventId?: string) => {
				if (!eventId) {
					this.latestEventIds.delete(eventScopeId);
					return;
				}
				this.latestEventIds.set(eventScopeId, eventId);
			},
		};
	}
}
