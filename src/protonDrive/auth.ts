import {Notice} from "obsidian";

type ProtonDriveAuthClient = {
	loginWithPassword?: (options: {
		username: string;
		password: string;
		twoFactorCode?: string;
	}) => Promise<AuthResponse>;
	login?: (options: {
		username: string;
		password: string;
		twoFactorCode?: string;
	}) => Promise<AuthResponse>;
	logout?: () => Promise<void>;
};

type ProtonDriveSdk = {
	createAuthClient?: () => Promise<ProtonDriveAuthClient>;
	default?: {
		createAuthClient?: () => Promise<ProtonDriveAuthClient>;
	};
};

type AuthResponse = {
	sessionToken?: string;
	userId?: string;
	userEmail?: string;
	twoFactorRequired?: boolean;
	status?: string;
	message?: string;
};

export type AuthSession = {
	sessionToken: string;
	userId?: string;
	userEmail?: string;
};

export class ProtonDriveAuthService {
	private authClient: ProtonDriveAuthClient | null = null;

	async login(credentials: {
		username: string;
		password: string;
		twoFactorCode?: string;
	}): Promise<AuthSession> {
		const client = await this.getAuthClient();
		const loginMethod = client.loginWithPassword ?? client.login;

		if (!loginMethod) {
			throw new Error("Proton Drive SDK is missing a login method.");
		}

		const response = await loginMethod(credentials);

		if (response.sessionToken) {
			return {
				sessionToken: response.sessionToken,
				userId: response.userId,
				userEmail: response.userEmail ?? credentials.username
			};
		}

		if (response.twoFactorRequired || response.status === "TWO_FACTOR_REQUIRED") {
			throw new Error("Two-factor authentication is required. Provide a 2FA code and try again.");
		}

		throw new Error(response.message ?? "Unable to authenticate with Proton Drive.");
	}

	async logout(): Promise<void> {
		if (!this.authClient?.logout) {
			return;
		}

		try {
			await this.authClient.logout();
		} catch (error) {
			console.warn("Failed to logout from Proton Drive.", error);
			new Notice("Failed to logout from Proton Drive.");
		}
	}

	private async getAuthClient(): Promise<ProtonDriveAuthClient> {
		if (this.authClient) {
			return this.authClient;
		}

		const sdk = await import("@protontech/drive-sdk") as ProtonDriveSdk;
		const createAuthClient = sdk.createAuthClient ?? sdk.default?.createAuthClient;

		if (!createAuthClient) {
			throw new Error("Proton Drive SDK is missing createAuthClient.");
		}

		this.authClient = await createAuthClient();
		return this.authClient;
	}
}
