import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-api";
import type {
	AnyRemoteProvider,
	RemoteProvider,
	RemoteProviderClient,
	RemoteProviderCredentialsOf,
	RemoteProviderSessionOf,
} from "@contracts/provider/remote-provider";
import {
	createDriveSyncError,
	normalizeUnknownDriveSyncError,
	shouldPauseAuthForError,
	toDriveSyncErrorSummary,
	translateDriveSyncErrorUserMessage,
} from "@errors";
import { trAny } from "@i18n";
import { PluginDataStateStore } from "@sync/state/state-store";
import { now } from "@sync/support/utils";

function bindRemoteProvider<TProvider extends AnyRemoteProvider>(
	provider: TProvider,
): RemoteProvider<
	RemoteProviderClient<TProvider>,
	RemoteProviderSessionOf<TProvider>,
	RemoteProviderCredentialsOf<TProvider>
> {
	return provider as unknown as RemoteProvider<
		RemoteProviderClient<TProvider>,
		RemoteProviderSessionOf<TProvider>,
		RemoteProviderCredentialsOf<TProvider>
	>;
}

export class SessionManager<TProvider extends AnyRemoteProvider> {
	private authPaused = false;
	private lastAuthError: string | undefined;

	constructor(private readonly plugin: ObsidianDriveSyncPluginApi<TProvider>) {}

	async restoreSession(): Promise<void> {
		const provider = bindRemoteProvider(this.plugin.getRemoteProvider());
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
			const normalized = normalizeUnknownDriveSyncError(error, {
				category: "auth",
				userMessage: "Authentication required. Sign in again to continue.",
				userMessageKey: "error.auth.reauthRequired",
			});
			console.warn("Failed to restore remote session.", error);
			this.plugin.clearStoredRemoteSession();
			await this.plugin.saveSettings();
			this.authPaused = shouldPauseAuthForError(normalized);
			this.lastAuthError = translateDriveSyncErrorUserMessage(normalized, trAny);
			await this.recordAuthError(normalized, "Remote session restore failed");
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

	pauseAuth(error: unknown): void {
		const normalized = normalizeUnknownDriveSyncError(error, {
			category: "auth",
			userMessage: "Authentication required. Sign in again to continue.",
			userMessageKey: "error.auth.reauthRequired",
		});
		this.authPaused = true;
		this.lastAuthError = translateDriveSyncErrorUserMessage(normalized, trAny);
		void this.recordAuthError(normalized, "Auth paused");
	}

	async buildActiveRemoteSession(): Promise<RemoteProviderSessionOf<TProvider> | null> {
		const provider = bindRemoteProvider(this.plugin.getRemoteProvider());
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
				const normalized = normalizeUnknownDriveSyncError(error, {
					category: "auth",
					userMessage: "Authentication required. Sign in again to continue.",
					userMessageKey: "error.auth.reauthRequired",
				});
				console.warn("Failed to restore remote session.", error);
				this.plugin.clearStoredRemoteSession();
				await this.plugin.saveSettings();
				this.authPaused = shouldPauseAuthForError(normalized);
				this.lastAuthError = translateDriveSyncErrorUserMessage(normalized, trAny);
				await this.recordAuthError(normalized, "Remote session restore failed");
				return null;
			}
		}

		if (!session) {
			return null;
		}

		return session;
	}

	async connectClient(): Promise<RemoteProviderClient<TProvider>> {
		const provider = bindRemoteProvider(this.plugin.getRemoteProvider());
		const session = await this.buildActiveRemoteSession();
		if (!session) {
			throw createDriveSyncError("AUTH_SIGN_IN_REQUIRED", {
				category: "auth",
				userMessage: `Sign in to ${provider.label} first.`,
				userMessageKey: "error.auth.signInToProviderFirst",
				userMessageParams: { provider: provider.label },
				details: { providerId: provider.id },
			});
		}
		const client = await provider.connect(session, {
			onTokenRefresh: async () => {
				await this.refreshAndPersistSession();
			},
		});
		if (!client) {
			throw createDriveSyncError("PROVIDER_CONNECT_FAILED", {
				category: "provider",
				userMessage: `Unable to connect to ${provider.label}.`,
				userMessageKey: "error.provider.unableToConnectNamed",
				userMessageParams: { provider: provider.label },
				details: { providerId: provider.id },
			});
		}
		this.handleAuthRecovered();
		return client;
	}

	private async refreshAndPersistSession(): Promise<void> {
		const provider = bindRemoteProvider(this.plugin.getRemoteProvider());
		try {
			await provider.refreshToken();
			this.plugin.setStoredProviderCredentials(provider.getReusableCredentials());
			this.plugin.setRemoteAuthSession(true);
			await this.plugin.saveSettings();
			this.handleAuthRecovered();
		} catch (refreshError) {
			const normalized = normalizeUnknownDriveSyncError(refreshError, {
				category: "auth",
				userMessage: "Authentication required. Sign in again to continue.",
				userMessageKey: "error.auth.reauthRequired",
			});
			console.warn("Failed to refresh remote session.", refreshError);
			this.plugin.setRemoteAuthSession(false);
			this.authPaused = shouldPauseAuthForError(normalized);
			this.lastAuthError = translateDriveSyncErrorUserMessage(normalized, trAny);
			await this.plugin.saveSettings();
			await this.recordAuthError(normalized, "Remote session refresh failed");
			throw normalized;
		}
	}

	private async recordAuthError(error: unknown, message: string): Promise<void> {
		const summary = toDriveSyncErrorSummary(error);
		const stateStore = new PluginDataStateStore();
		const state = await stateStore.load();
		const logs = [
			...(state.logs ?? []),
			{
				at: new Date().toISOString(),
				message,
				context: "auth" as const,
				code: summary.code,
				category: summary.category,
				retryable: summary.retryable,
			},
		].slice(-200);
		await stateStore.save({
			...state,
			lastErrorAt: now(),
			lastErrorCode: summary.code,
			lastErrorCategory: summary.category,
			lastErrorRetryable: summary.retryable,
			logs,
		});
	}
}
