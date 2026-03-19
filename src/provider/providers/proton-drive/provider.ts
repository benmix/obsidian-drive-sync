import type { RemoteFileSystem } from "@contracts/filesystem/file-system";
import type { ReusableCredentials } from "@contracts/provider/proton/auth-types";
import type {
	ProtonDriveAuthServiceContract,
	ProtonDriveConnectedClient,
	ProtonDriveProvider,
	ProtonDriveProviderInitOptions,
	ProtonDriveServiceContract,
} from "@contracts/provider/proton/drive-provider";
import type { ProtonRootNodeResult } from "@contracts/provider/proton/drive-sdk";
import type { ProtonSession } from "@contracts/provider/proton/sdk-session";
import type {
	RemoteProviderConnectOptions,
	RemoteProviderLoginInput,
	RemoteScopeRoot,
} from "@contracts/provider/remote-provider";
import { createDriveSyncError } from "@errors";
import { ProtonDriveRemoteFileSystem } from "@provider/providers/proton-drive/remote-file-system";
import { ProtonDriveAuthService } from "@provider/providers/proton-drive/sdk/auth";
import { ProtonDriveService } from "@provider/providers/proton-drive/sdk/service";

export class ProtonDriveRemoteProvider implements ProtonDriveProvider {
	readonly id = "proton-drive";
	readonly label = "Proton Drive";

	constructor(
		private readonly authService: ProtonDriveAuthServiceContract,
		private readonly driveService: ProtonDriveServiceContract,
	) {}

	async login(input: RemoteProviderLoginInput) {
		const result = await this.authService.login(input);
		return {
			session: result.session,
			credentials: result.credentials,
			userEmail: result.userEmail,
		};
	}

	async restore(credentials: ReusableCredentials): Promise<ProtonSession> {
		return await this.authService.restore(credentials);
	}

	getSession(): ProtonSession | null {
		return this.authService.getSession();
	}

	async refreshToken(): Promise<ProtonSession> {
		return await this.authService.refreshToken();
	}

	getReusableCredentials(): ReusableCredentials {
		return this.authService.getReusableCredentials();
	}

	async logout(): Promise<void> {
		await this.authService.logout();
	}

	isSessionValidated(): boolean {
		return this.authService.isSessionValidated();
	}

	async connect(
		session: ProtonSession,
		options?: RemoteProviderConnectOptions,
	): Promise<ProtonDriveConnectedClient | null> {
		return await this.driveService.connect(
			session,
			() => this.authService.getSession() ?? session,
			options?.onTokenRefresh,
		);
	}

	disconnect(): void {
		this.driveService.disconnect();
	}

	async getRootScope(client: ProtonDriveConnectedClient): Promise<RemoteScopeRoot> {
		const rootResult = (await client.sdk.getMyFilesRootFolder()) as ProtonRootNodeResult;
		if (!rootResult.ok) {
			throw createDriveSyncError("REMOTE_NOT_FOUND", {
				category: "remote_fs",
				debugMessage: "Unable to load root folder.",
			});
		}
		const rootNode = rootResult.value;
		return {
			id: rootNode.uid,
			label: rootNode.name || "My files",
		};
	}

	createRemoteFileSystem(client: ProtonDriveConnectedClient, scopeId: string): RemoteFileSystem {
		return new ProtonDriveRemoteFileSystem(client, scopeId);
	}

	async validateScope(
		client: ProtonDriveConnectedClient,
		scopeId: string,
	): Promise<{ ok: boolean; message: string }> {
		const remoteFileSystem = this.createRemoteFileSystem(client, scopeId);
		try {
			const node = await remoteFileSystem.getEntry?.(scopeId);
			if (!node) {
				return { ok: false, message: "Folder not found." };
			}
			if (node.type !== "folder") {
				return { ok: false, message: "Selected node is not a folder." };
			}
			return { ok: true, message: "OK" };
		} catch (error) {
			console.warn("Remote folder validation failed.", error);
			return { ok: false, message: "Failed to validate folder." };
		}
	}
}

export function createProtonDriveRemoteProvider(
	options: ProtonDriveProviderInitOptions = {},
): ProtonDriveRemoteProvider {
	return new ProtonDriveRemoteProvider(
		options.authService ?? new ProtonDriveAuthService(),
		options.driveService ?? new ProtonDriveService(),
	);
}
