import { type ObsidianDriveSyncPluginRuntimeApi } from "@contracts/plugin/plugin-api";
import type { AnyRemoteProvider } from "@contracts/provider/remote-provider";
import { type SyncRunRequest } from "@contracts/sync/run-request";
import type { SessionManager } from "@runtime/session-manager";
import { PluginDataStateStore } from "@sync/state/state-store";
import { SyncRunner } from "@sync/use-cases/sync-runner";

export class SyncCoordinator<TProvider extends AnyRemoteProvider> {
	private readonly syncRunner = new SyncRunner(new PluginDataStateStore());

	constructor(
		private readonly plugin: ObsidianDriveSyncPluginRuntimeApi<TProvider>,
		private readonly sessionManager: SessionManager<TProvider>,
	) {}

	async run(request: SyncRunRequest): Promise<void> {
		const remoteState = this.plugin.getRemoteConnectionView();
		const scopeId = remoteState.scopeId;
		if (!scopeId) {
			return;
		}
		const client = await this.sessionManager.connectClient();
		const localProvider = this.plugin.getLocalProvider();
		const localFileSystem = localProvider.createLocalFileSystem(this.plugin.app);
		const remoteFileSystem = this.plugin
			.getRemoteProvider()
			.createRemoteFileSystem(client, scopeId);

		await this.syncRunner.run(request, {
			localFileSystem,
			remoteFileSystem,
			syncStrategy: this.plugin.settings.syncStrategy,
			onAuthError: (error) => {
				this.sessionManager.pauseAuth(error);
			},
		});
	}
}
