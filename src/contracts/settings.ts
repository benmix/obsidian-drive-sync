import type { SyncStrategy } from "../sync/contracts/strategy";

export interface DriveSyncSettings {
	remoteProviderId: string;
	remoteScopeId: string;
	remoteScopePath: string;
	remoteProviderCredentials?: unknown;
	remoteAccountEmail: string;
	remoteHasAuthSession: boolean;
	syncStrategy: SyncStrategy;
	autoSyncEnabled: boolean;
	enableNetworkPolicy: boolean;
}
