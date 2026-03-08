import type { RemoteFileSystem } from "../../filesystem";

export type RemoteFileSystemStrategyContext = {
	providerId: string;
	client: unknown;
	scopeId: string;
};

export type RemoteFileSystemStrategy = (
	remoteFileSystem: RemoteFileSystem,
	context: RemoteFileSystemStrategyContext,
) => RemoteFileSystem;

export function applyRemoteFileSystemStrategies(
	baseRemoteFileSystem: RemoteFileSystem,
	context: RemoteFileSystemStrategyContext,
	strategies: readonly RemoteFileSystemStrategy[],
): RemoteFileSystem {
	return strategies.reduce(
		(remoteFileSystem, strategy) => strategy(remoteFileSystem, context),
		baseRemoteFileSystem,
	);
}
