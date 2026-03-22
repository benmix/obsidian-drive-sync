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
	type DriveSyncError,
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
		const remoteState = this.plugin.getRemoteConnectionState();
		const provider = bindRemoteProvider(remoteState.provider);
		const credentials = remoteState.credentials;
		if (!credentials) {
			this.plugin.updateRemoteConnectionState({
				hasAuthSession: false,
			});
			return;
		}

		await this.restoreStoredSession(provider, credentials, {
			persistSettings: false,
		});
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
		const normalized = this.normalizeAuthError(error);
		this.applyAuthFailureState(normalized);
		void this.recordAuthError(normalized, "Auth paused");
	}

	async buildActiveRemoteSession(): Promise<RemoteProviderSessionOf<TProvider> | null> {
		const remoteState = this.plugin.getRemoteConnectionState();
		const provider = bindRemoteProvider(remoteState.provider);
		const credentials = remoteState.credentials;
		let session = provider.getSession();

		if (!session && credentials) {
			session = await this.restoreStoredSession(provider, credentials, {
				persistSettings: true,
			});
		}

		if (!session) {
			return null;
		}

		return session;
	}

	async connectClient(): Promise<RemoteProviderClient<TProvider>> {
		const provider = bindRemoteProvider(this.plugin.getRemoteConnectionState().provider);
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
		const provider = bindRemoteProvider(this.plugin.getRemoteConnectionState().provider);
		try {
			await provider.refreshToken();
			await this.persistRecoveredSession(provider, {
				persistSettings: true,
			});
		} catch (refreshError) {
			const normalized = await this.handleAuthFailure(refreshError, {
				warnMessage: "Failed to refresh remote session.",
				logMessage: "Remote session refresh failed",
				clearStoredSession: false,
				hasAuthSession: false,
				persistSettings: true,
			});
			throw normalized;
		}
	}

	private normalizeAuthError(error: unknown): DriveSyncError {
		return normalizeUnknownDriveSyncError(error, {
			category: "auth",
			userMessage: "Authentication required. Sign in again to continue.",
			userMessageKey: "error.auth.reauthRequired",
		});
	}

	private applyAuthFailureState(error: DriveSyncError): void {
		this.authPaused = shouldPauseAuthForError(error);
		this.lastAuthError = translateDriveSyncErrorUserMessage(error, trAny);
	}

	private async persistRecoveredSession(
		provider: RemoteProvider<
			RemoteProviderClient<TProvider>,
			RemoteProviderSessionOf<TProvider>,
			RemoteProviderCredentialsOf<TProvider>
		>,
		options: { persistSettings: boolean },
	): Promise<void> {
		this.plugin.updateRemoteConnectionState({
			credentials: provider.getReusableCredentials(),
			hasAuthSession: true,
		});
		if (options.persistSettings) {
			await this.plugin.saveSettings();
		}
		this.handleAuthRecovered();
	}

	private async restoreStoredSession(
		provider: RemoteProvider<
			RemoteProviderClient<TProvider>,
			RemoteProviderSessionOf<TProvider>,
			RemoteProviderCredentialsOf<TProvider>
		>,
		credentials: RemoteProviderCredentialsOf<TProvider>,
		options: { persistSettings: boolean },
	): Promise<RemoteProviderSessionOf<TProvider> | null> {
		try {
			const session = await provider.restore(credentials);
			await this.persistRecoveredSession(provider, options);
			return session;
		} catch (error) {
			await this.handleAuthFailure(error, {
				warnMessage: "Failed to restore remote session.",
				logMessage: "Remote session restore failed",
				clearStoredSession: true,
				persistSettings: true,
			});
			return null;
		}
	}

	private async handleAuthFailure(
		error: unknown,
		options: {
			warnMessage: string;
			logMessage: string;
			clearStoredSession?: boolean;
			hasAuthSession?: boolean;
			persistSettings: boolean;
		},
	): Promise<DriveSyncError> {
		const normalized = this.normalizeAuthError(error);
		console.warn(options.warnMessage, error);
		if (options.clearStoredSession) {
			this.plugin.clearStoredRemoteSession();
		}
		if (typeof options.hasAuthSession === "boolean") {
			this.plugin.updateRemoteConnectionState({
				hasAuthSession: options.hasAuthSession,
			});
		}
		if (options.persistSettings) {
			await this.plugin.saveSettings();
		}
		this.applyAuthFailureState(normalized);
		await this.recordAuthError(normalized, options.logMessage);
		return normalized;
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
