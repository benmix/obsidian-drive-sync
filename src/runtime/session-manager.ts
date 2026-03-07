import type { ObsidianDriveSyncPluginApi } from "../plugin/contracts";
import type { RemoteProviderSession } from "../provider/contracts";

export class SessionManager {
	private authPaused = false;
	private lastAuthError: string | undefined;

	constructor(private readonly plugin: ObsidianDriveSyncPluginApi) {}

	async restoreSession(): Promise<void> {
		const provider = this.plugin.getRemoteProvider();
		const credentials = this.plugin.getStoredProviderCredentials();
		if (!credentials) {
			this.plugin.setRemoteAuthSession(false);
			return;
		}

		try {
			await provider.restore(credentials);
			this.plugin.setStoredProviderCredentials(provider.getReusableCredentials());
			this.plugin.setRemoteAuthSession(true);
			this.handleAuthRecovered();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to restore remote session.";
			console.warn("Failed to restore remote session.", error);
			this.plugin.clearStoredRemoteSession();
			await this.plugin.saveSettings();
			this.authPaused = true;
			this.lastAuthError = message;
		}
	}

	isAuthPaused(): boolean {
		return this.authPaused;
	}

	getLastAuthError(): string | undefined {
		return this.lastAuthError;
	}

	handleAuthRecovered(): void {
		this.authPaused = false;
		this.lastAuthError = undefined;
	}

	pauseAuth(message: string): void {
		this.authPaused = true;
		this.lastAuthError = message;
	}

	async buildActiveRemoteSession(): Promise<RemoteProviderSession | null> {
		const provider = this.plugin.getRemoteProvider();
		const credentials = this.plugin.getStoredProviderCredentials();
		let session = provider.getSession();

		if (!session && credentials) {
			try {
				session = await provider.restore(credentials);
				this.plugin.setStoredProviderCredentials(provider.getReusableCredentials());
				this.plugin.setRemoteAuthSession(true);
				await this.plugin.saveSettings();
				this.handleAuthRecovered();
			} catch (error) {
				console.warn("Failed to restore remote session.", error);
				this.plugin.clearStoredRemoteSession();
				await this.plugin.saveSettings();
				return null;
			}
		}

		if (!session) {
			return null;
		}

		return { ...session };
	}

	async connectClient(): Promise<unknown> {
		const provider = this.plugin.getRemoteProvider();
		const session = await this.buildActiveRemoteSession();
		if (!session) {
			throw new Error(`Sign in to ${provider.label} first.`);
		}
		const client = await provider.connect(session, {
			onTokenRefresh: async () => {
				await this.refreshAndPersistSession();
			},
		});
		if (!client) {
			throw new Error(`Unable to connect to ${provider.label}.`);
		}
		this.handleAuthRecovered();
		return client;
	}

	private async refreshAndPersistSession(): Promise<void> {
		const provider = this.plugin.getRemoteProvider();
		try {
			await provider.refreshToken();
			this.plugin.setStoredProviderCredentials(provider.getReusableCredentials());
			this.plugin.setRemoteAuthSession(true);
			await this.plugin.saveSettings();
			this.handleAuthRecovered();
		} catch (refreshError) {
			console.warn("Failed to refresh remote session.", refreshError);
			this.plugin.setRemoteAuthSession(false);
			this.authPaused = true;
			this.lastAuthError =
				refreshError instanceof Error
					? refreshError.message
					: "Failed to refresh remote session.";
			await this.plugin.saveSettings();
			throw refreshError;
		}
	}
}
