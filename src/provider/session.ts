import type { ObsidianDriveSyncPluginApi } from "../plugin/contracts";
import type { RemoteProviderSession } from "./contracts";

export async function buildActiveRemoteSession(
	plugin: ObsidianDriveSyncPluginApi,
): Promise<RemoteProviderSession | null> {
	const provider = plugin.getRemoteProvider();
	const credentials = plugin.getStoredProviderCredentials();
	let session = provider.getSession();

	if (!session && credentials) {
		try {
			session = await provider.restore(credentials);
			plugin.setStoredProviderCredentials(provider.getReusableCredentials());
			plugin.setRemoteAuthSession(true);
			await plugin.saveSettings();
			plugin.handleAuthRecovered(false);
		} catch (error) {
			console.warn("Failed to restore remote session.", error);
			plugin.clearStoredRemoteSession();
			await plugin.saveSettings();
			return null;
		}
	}

	if (!session) {
		return null;
	}

	const activeSession: RemoteProviderSession = {
		...session,
	};
	activeSession.onTokenRefresh = async () => {
		try {
			await provider.refreshToken();
			const refreshedSession = provider.getSession();
			if (refreshedSession) {
				Object.assign(activeSession, refreshedSession);
			}
			plugin.setStoredProviderCredentials(provider.getReusableCredentials());
			plugin.setRemoteAuthSession(true);
			await plugin.saveSettings();
			plugin.handleAuthRecovered(false);
		} catch (refreshError) {
			console.warn("Failed to refresh remote session.", refreshError);
			plugin.setRemoteAuthSession(false);
			await plugin.saveSettings();
		}
	};

	return activeSession;
}
