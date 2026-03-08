import { DEFAULT_REMOTE_PROVIDER_ID } from "../provider/provider-ids";
import { DEFAULT_SYNC_STRATEGY } from "../sync/strategy";

import type { DriveSyncSettings } from "./settings";

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
