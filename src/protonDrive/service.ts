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
		const sdk = await import("@protontech/drive-sdk") as ProtonDriveSdk;

		const createDriveClient = sdk.createDriveClient ?? sdk.default?.createDriveClient;
		if (!createDriveClient) {
			throw new Error("Proton Drive SDK is missing createDriveClient.");
		}

		return await createDriveClient(options);
	}
}
