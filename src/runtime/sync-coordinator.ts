import { type ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import { PluginDataStateStore } from "../sync/state/state-store";
import type { SessionManager } from "./session-manager";
import { SyncRunner } from "../sync/use-cases/sync-runner";
import { type SyncRunRequest } from "../contracts/sync/run-request";

export class SyncCoordinator {
	private readonly syncRunner = new SyncRunner(new PluginDataStateStore());

	constructor(
		private readonly plugin: ObsidianDriveSyncPluginApi,
		private readonly sessionManager: SessionManager,
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
			onAuthError: (message) => {
				this.sessionManager.pauseAuth(message);
			},
		});
	}
}
