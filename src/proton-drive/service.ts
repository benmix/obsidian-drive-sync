import { Notice } from "obsidian";
import { ProtonDriveClient, MemoryCache } from "@protontech/drive-sdk";
import { buildSdkSessionClient, type ProtonSession } from "./sdk-session";

export class ProtonDriveService {
	private client: ProtonDriveClient | null = null;
	private connecting: Promise<ProtonDriveClient | null> | null = null;

	async connect(session: ProtonSession): Promise<ProtonDriveClient | null> {
		if (this.client) {
			return this.client;
		}

		if (this.connecting) {
			return this.connecting;
		}

		this.connecting = this.createClient(session).finally(() => {
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

	getClient(): ProtonDriveClient | null {
		return this.client;
	}

	disconnect() {
		if (
			this.client &&
			typeof (this.client as { disconnect?: () => void }).disconnect === "function"
		) {
			try {
				(this.client as { disconnect: () => void }).disconnect();
			} catch (error) {
				console.warn("Failed to disconnect Proton Drive client.", error);
			}
		}

		this.client = null;
	}

	private async createClient(session: ProtonSession): Promise<ProtonDriveClient | null> {
		const { httpClient, account, openPGPCryptoModule, srpModule, telemetry } =
			await buildSdkSessionClient(session, async () => {
				await session.onTokenRefresh?.();
			});

		return new ProtonDriveClient({
			httpClient,
			entitiesCache: new MemoryCache(),
			cryptoCache: new MemoryCache(),
			// @ts-expect-error openpgp type wrappers differ from SDK types.
			account,
			// @ts-expect-error openpgp type wrappers differ from SDK types.
			openPGPCryptoModule,
			srpModule,
			telemetry,
		});
	}
}
