import type { DriveSyncSettings } from "@contracts/plugin/settings";
import { DEFAULT_REMOTE_PROVIDER_ID } from "@contracts/provider/provider-ids";
import { DEFAULT_SYNC_STRATEGY } from "@contracts/sync/strategy";

export const DEFAULT_SETTINGS: DriveSyncSettings = {
	remoteProviderId: DEFAULT_REMOTE_PROVIDER_ID,
	remoteScopeId: "",
	remoteScopePath: "",
	remoteProviderCredentials: undefined,
	remoteAccountEmail: "",
	remoteHasAuthSession: false,
	syncStrategy: DEFAULT_SYNC_STRATEGY,
	autoSyncEnabled: false,
	enableNetworkPolicy: false,
};
