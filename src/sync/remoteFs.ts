import type { RemoteFileEntry, RemoteFileSystem } from "./types";

type ProtonDriveClient = {
	files?: {
		uploadFile?: (options: {
			parentId: string;
			name: string;
			data: Uint8Array;
			path?: string;
		}) => Promise<void>;
		listFolder?: (options: {
			parentId: string;
		}) => Promise<Array<{ id: string; name: string }>>;
		downloadFile?: (options: { id: string }) => Promise<Uint8Array>;
		deleteFile?: (options: { id: string }) => Promise<void>;
		moveFile?: (options: {
			id: string;
			parentId: string;
			name?: string;
		}) => Promise<void>;
	};
};

export class ProtonDriveRemoteFs implements RemoteFileSystem {
	private client: ProtonDriveClient;
	private remoteFolderId: string;

	constructor(client: ProtonDriveClient, remoteFolderId: string) {
		this.client = client;
		this.remoteFolderId = remoteFolderId;
	}

	async listFiles(): Promise<RemoteFileEntry[]> {
		if (!this.client.files?.listFolder) {
			throw new Error(
				"Proton Drive SDK does not expose files.listFolder.",
			);
		}
		const entries = await this.client.files.listFolder({
			parentId: this.remoteFolderId,
		});
		return entries.map((entry) => ({
			id: entry.id,
			name: entry.name,
			mtimeMs: (entry as { modificationTime?: number }).modificationTime,
			size: (entry as { storageSize?: number }).storageSize,
			revisionId: (entry as { activeRevision?: { uid?: string } })
				.activeRevision?.uid,
		}));
	}

	async uploadFile(path: string, data: Uint8Array): Promise<void> {
		if (!this.client.files?.uploadFile) {
			throw new Error(
				"Proton Drive SDK does not expose files.uploadFile.",
			);
		}
		await this.client.files.uploadFile({
			parentId: this.remoteFolderId,
			name: path,
			data,
			path,
		});
	}

	async downloadFile(id: string): Promise<Uint8Array> {
		if (!this.client.files?.downloadFile) {
			throw new Error(
				"Proton Drive SDK does not expose files.downloadFile.",
			);
		}
		return await this.client.files.downloadFile({ id });
	}

	async deletePath(id: string): Promise<void> {
		if (!this.client.files?.deleteFile) {
			throw new Error(
				"Proton Drive SDK does not expose files.deleteFile.",
			);
		}
		await this.client.files.deleteFile({ id });
	}

	async movePath(id: string, newName: string): Promise<void> {
		if (!this.client.files?.moveFile) {
			throw new Error("Proton Drive SDK does not expose files.moveFile.");
		}
		await this.client.files.moveFile({
			id,
			parentId: this.remoteFolderId,
			name: newName,
		});
	}
}
