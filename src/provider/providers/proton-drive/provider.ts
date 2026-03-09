import type { ProtonDriveClient } from "@protontech/drive-sdk";

import type { RemoteFileSystem } from "../../../contracts/filesystem/file-system";
import type { ReusableCredentials } from "../../../contracts/provider/proton/auth-types";
import type {
	ProtonDriveAuthServiceContract,
	ProtonDriveProviderInitOptions,
	ProtonDriveServiceContract,
} from "../../../contracts/provider/proton/drive-provider";
import type { ProtonSession } from "../../../contracts/provider/proton/sdk-session";
import type {
	RemoteProvider,
	RemoteProviderConnectOptions,
	RemoteProviderCredentials,
	RemoteProviderLoginInput,
	RemoteProviderLoginResult,
	RemoteProviderSession,
	RemoteScopeRoot,
} from "../../../contracts/provider/remote-provider";
import { createDriveSyncError } from "../../../errors";

import { ProtonDriveRemoteFileSystem } from "./remote-file-system";
import { ProtonDriveAuthService } from "./sdk/auth";
import { ProtonDriveService } from "./sdk/service";

export class ProtonDriveRemoteProvider implements RemoteProvider {
	readonly id = "proton-drive";
	readonly label = "Proton Drive";

	constructor(
		private readonly authService: ProtonDriveAuthServiceContract,
		private readonly driveService: ProtonDriveServiceContract,
	) {}

	async login(input: RemoteProviderLoginInput): Promise<RemoteProviderLoginResult> {
		const result = await this.authService.login(input);
		return {
			session: result.session as unknown as RemoteProviderSession,
			credentials: result.credentials,
			userEmail: result.userEmail,
		};
	}

	async restore(credentials: RemoteProviderCredentials): Promise<RemoteProviderSession> {
		const session = await this.authService.restore(credentials as ReusableCredentials);
		return session as unknown as RemoteProviderSession;
	}

	getSession(): RemoteProviderSession | null {
		return this.authService.getSession() as unknown as RemoteProviderSession | null;
	}

	async refreshToken(): Promise<RemoteProviderSession> {
		const session = await this.authService.refreshToken();
		return session as unknown as RemoteProviderSession;
	}

	getReusableCredentials(): RemoteProviderCredentials {
		return this.authService.getReusableCredentials();
	}

	async logout(): Promise<void> {
		await this.authService.logout();
	}

	isSessionValidated(): boolean {
		return this.authService.isSessionValidated();
	}

	async connect(
		session: RemoteProviderSession,
		options?: RemoteProviderConnectOptions,
	): Promise<unknown | null> {
		return await this.driveService.connect(
			session as unknown as ProtonSession,
			options?.onTokenRefresh,
		);
	}

	disconnect(): void {
		this.driveService.disconnect();
	}

	async getRootScope(client: unknown): Promise<RemoteScopeRoot> {
		const rootResult =
			typeof (client as { getMyFilesRootFolder?: () => Promise<unknown> })
				.getMyFilesRootFolder === "function"
				? await (
						client as {
							getMyFilesRootFolder: () => Promise<unknown>;
						}
					).getMyFilesRootFolder()
				: null;
		if (!rootResult || !(rootResult as { ok?: boolean }).ok) {
			throw createDriveSyncError("REMOTE_NOT_FOUND", {
				category: "remote_fs",
				debugMessage: "Unable to load root folder.",
			});
		}
		const rootNode = (rootResult as { value: { uid: string; name: string } }).value;
		return {
			id: rootNode.uid,
			label: rootNode.name || "My files",
		};
	}

	createRemoteFileSystem(client: unknown, scopeId: string): RemoteFileSystem {
		return new ProtonDriveRemoteFileSystem(client as ProtonDriveClient, scopeId);
	}

	async validateScope(
		client: unknown,
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
