import type { RemoteProviderId } from "@contracts/provider/provider-ids";

export type RemoteProviderOption = {
	id: RemoteProviderId;
	label: string;
};

export type RemoteConnectionView = {
	providerId: RemoteProviderId;
	providerLabel: string;
	scopeId: string;
	scopePath: string;
	accountEmail: string;
	hasAuthSession: boolean;
	hasStoredCredentials: boolean;
	isSessionValidated: boolean;
};

export type RemoteAuthStatus =
	| "signed_out"
	| "needs_attention"
	| "pending_validation"
	| "signed_in"
	| "paused";

export type RemoteAuthView = {
	status: RemoteAuthStatus;
	message?: string;
	providerId: RemoteProviderId;
	providerLabel: string;
	accountEmail: string;
	canConnect: boolean;
	canBrowseRemoteFolder: boolean;
};

export type RemoteFolderEntry = {
	id: string;
	name: string;
	path?: string;
	type: "folder" | "file";
};

export type RemoteFolderBrowser = {
	listFolderEntries(): Promise<RemoteFolderEntry[]>;
	listChildFolderEntries?(): Promise<RemoteFolderEntry[]>;
	ensureFolder?(path: string): Promise<{ id?: string }>;
};
