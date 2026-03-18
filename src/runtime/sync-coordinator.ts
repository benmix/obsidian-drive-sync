import { type ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import type { AnyRemoteProvider } from "../contracts/provider/remote-provider";
import { type SyncRunRequest } from "../contracts/sync/run-request";
import { PluginDataStateStore } from "../sync/state/state-store";
import { SyncRunner } from "../sync/use-cases/sync-runner";

import type { SessionManager } from "./session-manager";

export class SyncCoordinator<TProvider extends AnyRemoteProvider> {
	private readonly syncRunner = new SyncRunner(new PluginDataStateStore());

	constructor(
		private readonly plugin: ObsidianDriveSyncPluginApi<TProvider>,
		private readonly sessionManager: SessionManager<TProvider>,
	) {}

	async run(request: SyncRunRequest): Promise<void> {
		const scopeId = this.plugin.getRemoteScopeId();
		if (!scopeId) {
			return;
		}
		const client = await this.sessionManager.connectClient();
		const remoteProvider = this.plugin.getRemoteProvider();
		const localProvider = this.plugin.getLocalProvider();
		const localFileSystem = localProvider.createLocalFileSystem(this.plugin.app);
		const remoteFileSystem = remoteProvider.createRemoteFileSystem(client, scopeId);

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
