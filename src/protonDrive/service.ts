import {Notice} from "obsidian";

type ProtonDriveClient = unknown;

type ProtonDriveSdk = {
	createDriveClient?: (options: Record<string, unknown>) => Promise<ProtonDriveClient>;
	default?: {
		createDriveClient?: (options: Record<string, unknown>) => Promise<ProtonDriveClient>;
	};
};

export class ProtonDriveService {
	private client: ProtonDriveClient | null = null;
	private connecting: Promise<ProtonDriveClient | null> | null = null;

	async connect(options: Record<string, unknown>): Promise<ProtonDriveClient | null> {
		if (this.client) {
			return this.client;
		}

		if (this.connecting) {
			return this.connecting;
		}

		this.connecting = this.createClient(options).finally(() => {
			this.connecting = null;
		});

		this.client = await this.connecting;
		return this.client;
	}

	getClient(): ProtonDriveClient | null {
		return this.client;
	}

	disconnect() {
		if (this.client && typeof (this.client as {disconnect?: () => void}).disconnect === "function") {
			try {
				(this.client as {disconnect: () => void}).disconnect();
			} catch (error) {
				console.warn("Failed to disconnect Proton Drive client.", error);
			}
		}

		this.client = null;
	}

	private async createClient(options: Record<string, unknown>): Promise<ProtonDriveClient | null> {
		const sdk = await import("@protontech/drive-sdk").catch((error: unknown) => ({
			__error: error
		})) as ProtonDriveSdk & {__error?: unknown};

		if ("__error" in sdk) {
			console.warn("Unable to import @protontech/drive-sdk.", sdk.__error);
			new Notice("Install @protontech/drive-sdk to enable Proton Drive integration.");
			return null;
		}

		const createDriveClient = sdk.createDriveClient ?? sdk.default?.createDriveClient;
		if (!createDriveClient) {
			new Notice("Proton Drive SDK is missing createDriveClient.");
			return null;
		}

		try {
			return await createDriveClient(options);
		} catch (error) {
			console.warn("Failed to create Proton Drive client.", error);
			new Notice("Failed to create Proton Drive client.");
			return null;
		}
	}
}
