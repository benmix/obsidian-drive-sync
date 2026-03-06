import {
	applyRemoteFileSystemStrategies,
	type RemoteFileSystemStrategy,
} from "../../remote-file-system/contracts";
import type {
	RemoteProvider,
	RemoteProviderCredentials,
	RemoteProviderLoginInput,
	RemoteProviderLoginResult,
	RemoteProviderSession,
	RemoteScopeRoot,
} from "../../contracts";
import { createRateLimitedRemoteFileSystemStrategy } from "../../remote-file-system/strategies/rate-limited-remote-file-system";
import { ProtonDriveAuthService } from "./sdk/auth";
import type { ProtonDriveClient } from "@protontech/drive-sdk";
import { ProtonDriveRemoteFileSystem } from "./remote-file-system";
import { ProtonDriveService } from "./sdk/service";
import type { ProtonSession } from "./sdk/sdk-session";
import type { RemoteFileSystem } from "../../../filesystem/contracts";
import type { ReusableCredentials } from "./sdk/proton-auth/types";

const DEFAULT_REMOTE_FILE_SYSTEM_STRATEGIES: readonly RemoteFileSystemStrategy[] = [
	createRateLimitedRemoteFileSystemStrategy(),
];

export class ProtonDriveRemoteProvider implements RemoteProvider {
	readonly id = "proton-drive";
	readonly label = "Proton Drive";

	constructor(
		private readonly authService: ProtonDriveAuthService,
		private readonly driveService: ProtonDriveService,
		private readonly remoteFileSystemStrategies: readonly RemoteFileSystemStrategy[] = DEFAULT_REMOTE_FILE_SYSTEM_STRATEGIES,
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

	async connect(session: RemoteProviderSession): Promise<unknown | null> {
		return await this.driveService.connect(session as unknown as ProtonSession);
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
			throw new Error("Unable to load root folder.");
		}
		const rootNode = (rootResult as { value: { uid: string; name: string } }).value;
		return {
			id: rootNode.uid,
			label: rootNode.name || "My files",
		};
	}

	createRemoteFileSystem(client: unknown, scopeId: string): RemoteFileSystem {
		const baseRemoteFileSystem = new ProtonDriveRemoteFileSystem(
			client as ProtonDriveClient,
			scopeId,
		);
		return applyRemoteFileSystemStrategies(
			baseRemoteFileSystem,
			{
				providerId: this.id,
				client,
				scopeId,
			},
			this.remoteFileSystemStrategies,
		);
	}

	async validateScope(
		client: unknown,
		scopeId: string,
	): Promise<{ ok: boolean; message: string }> {
		const remoteFileSystem = this.createRemoteFileSystem(client, scopeId);
		try {
			const node = await remoteFileSystem.getNode?.(scopeId);
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

export type ProtonDriveProviderInitOptions = {
	authService?: ProtonDriveAuthService;
	driveService?: ProtonDriveService;
	remoteFileSystemStrategies?: readonly RemoteFileSystemStrategy[];
};

export function createProtonDriveRemoteProvider(
	options: ProtonDriveProviderInitOptions = {},
): ProtonDriveRemoteProvider {
	return new ProtonDriveRemoteProvider(
		options.authService ?? new ProtonDriveAuthService(),
		options.driveService ?? new ProtonDriveService(),
		options.remoteFileSystemStrategies ?? DEFAULT_REMOTE_FILE_SYSTEM_STRATEGIES,
	);
}
