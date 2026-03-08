export const DEFAULT_REMOTE_PROVIDER_ID = "proton-drive";
export const DEFAULT_LOCAL_PROVIDER_ID = "obsidian-local";

export type RemoteProviderId = string;
export type LocalProviderId = string;

const BUILT_IN_REMOTE_PROVIDER_ID_SET = new Set<string>([DEFAULT_REMOTE_PROVIDER_ID]);
const BUILT_IN_LOCAL_PROVIDER_ID_SET = new Set<string>([DEFAULT_LOCAL_PROVIDER_ID]);

export function isSupportedRemoteProviderId(providerId: string): boolean {
	return BUILT_IN_REMOTE_PROVIDER_ID_SET.has(providerId);
}

export function isSupportedLocalProviderId(providerId: string): boolean {
	return BUILT_IN_LOCAL_PROVIDER_ID_SET.has(providerId);
}
