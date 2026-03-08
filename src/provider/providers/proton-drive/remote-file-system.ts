import mimeTypes from "mime-types";

import type {
	RemoteEntryChangeEvent,
	RemoteFileEntry,
	RemoteFileSystem,
} from "../../../contracts/filesystem/file-system";
import { basename, dirname, normalizePath, splitPath } from "../../../filesystem/path";

type ProtonDriveClient = {
	iterateFolderChildren?: (parentNodeUid: string) => AsyncIterable<unknown>;
	getFileDownloader?: (
		nodeUid: string,
		signal?: AbortSignal,
	) => Promise<{
		downloadToStream: (
			streamFactory: WritableStream,
			onProgress?: (downloadedBytes: number) => void,
		) => { completion: () => Promise<void> };
	}>;
	getFileUploader?: (
		parentFolderUid: string,
		name: string,
		metadata: {
			mediaType: string;
			expectedSize: number;
			modificationTime?: Date;
		},
		signal?: AbortSignal,
	) => Promise<{
		uploadFromFile: (
			file: File,
			thumbnails: [],
			onProgress?: (uploadedBytes: number) => void,
		) => Promise<{
			completion: () => Promise<{
				nodeUid: string;
				nodeRevisionUid: string;
			}>;
		}>;
		uploadFromStream: (
			stream: ReadableStream,
			thumbnails: [],
			onProgress?: (uploadedBytes: number) => void,
		) => Promise<{
			completion: () => Promise<{
				nodeUid: string;
				nodeRevisionUid: string;
			}>;
		}>;
	}>;
	getFileRevisionUploader?: (
		nodeUid: string,
		metadata: {
			mediaType: string;
			expectedSize: number;
			modificationTime?: Date;
		},
		signal?: AbortSignal,
	) => Promise<{
		uploadFromFile: (
			file: File,
			thumbnails: [],
			onProgress?: (uploadedBytes: number) => void,
		) => Promise<{
			completion: () => Promise<{
				nodeUid: string;
				nodeRevisionUid: string;
			}>;
		}>;
		uploadFromStream: (
			stream: ReadableStream,
			thumbnails: [],
			onProgress?: (uploadedBytes: number) => void,
		) => Promise<{
			completion: () => Promise<{
				nodeUid: string;
				nodeRevisionUid: string;
			}>;
		}>;
	}>;
	createFolder?: (
		parentNodeUid: string,
		name: string,
		modificationTime?: Date,
	) => Promise<unknown>;
	renameNode?: (nodeUid: string, newName: string) => Promise<unknown>;
	moveNodes?: (
		nodeUids: string[],
		newParentNodeUid: string,
		signal?: AbortSignal,
	) => AsyncIterable<{ ok: boolean; uid: string; error?: unknown }>;
	trashNodes?: (
		nodeUids: string[],
	) => AsyncIterable<{ ok: boolean; uid: string; error?: unknown }>;
	deleteNodes?: (
		nodeUids: string[],
	) => AsyncIterable<{ ok: boolean; uid: string; error?: unknown }>;
	iterateNodes?: (nodeUids: string[]) => AsyncIterable<unknown>;
	getNode?: (nodeUid: string) => Promise<unknown>;
	getMyFilesRootFolder?: () => Promise<unknown>;
	subscribeToTreeEvents?: (
		treeEventScopeId: string,
		callback: (event: unknown) => Promise<void>,
	) => Promise<{ dispose: () => void }>;
};

type NodeEntity = {
	uid: string;
	parentUid?: string;
	name: string;
	type: "file" | "folder";
	modificationTime?: Date;
	totalStorageSize?: number;
	activeRevision?: {
		uid: string;
		claimedModificationTime?: Date;
		storageSize?: number;
	};
	treeEventScopeId?: string;
};

type MaybeNode = { ok: true; value: NodeEntity } | { ok: false; error: unknown };

const DEFAULT_MEDIA_TYPE = "application/octet-stream";

function inferMediaType(fileName: string): string {
	const mediaType = mimeTypes.lookup(fileName);
	return typeof mediaType === "string" ? mediaType : DEFAULT_MEDIA_TYPE;
}

export class ProtonDriveRemoteFileSystem implements RemoteFileSystem {
	private client: ProtonDriveClient;
	private remoteFolderId: string;
	private folderPathCache = new Map<string, string>();
	private folderIdCache = new Map<string, string>();

	constructor(client: ProtonDriveClient, remoteFolderId: string) {
		this.client = client;
		this.remoteFolderId = remoteFolderId;
	}

	async listEntries(): Promise<RemoteFileEntry[]> {
		const entries: RemoteFileEntry[] = [];
		const queue: Array<{ id: string; path: string }> = [{ id: this.remoteFolderId, path: "" }];
		this.folderIdCache.set("", this.remoteFolderId);
		this.folderPathCache.set(this.remoteFolderId, "");

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) {
				continue;
			}
			for await (const node of this.iterateFolderChildren(current.id)) {
				const relPath = normalizePath(
					current.path ? `${current.path}/${node.name}` : node.name,
				);
				const entry: RemoteFileEntry = {
					id: node.uid,
					name: node.name,
					path: relPath,
					type: node.type === "folder" ? "folder" : "file",
					parentId: node.parentUid ?? current.id,
					eventScopeId: node.treeEventScopeId,
					mtimeMs: node.modificationTime?.getTime?.() ?? undefined,
					size: node.activeRevision?.storageSize ?? node.totalStorageSize ?? undefined,
					revisionId: node.activeRevision?.uid,
				};
				entries.push(entry);
				if (entry.type === "folder") {
					this.folderPathCache.set(entry.id, relPath);
					this.folderIdCache.set(relPath, entry.id);
					queue.push({ id: entry.id, path: relPath });
				}
			}
		}

		return entries;
	}

	async listFileEntries(): Promise<RemoteFileEntry[]> {
		const entries = await this.listEntries();
		return entries.filter((entry) => entry.type === "file");
	}

	async listFolderEntries(): Promise<RemoteFileEntry[]> {
		const entries = await this.listEntries();
		return entries.filter((entry) => entry.type === "folder");
	}

	async getEntry(id: string): Promise<RemoteFileEntry | null> {
		if (!this.client.getNode) {
			return null;
		}
		const result = (await this.client.getNode(id)) as MaybeNode;
		if (!result.ok) {
			return null;
		}
		return this.mapNodeToEntry(result.value);
	}

	async getRootEntry(): Promise<RemoteFileEntry | null> {
		if (!this.client.getMyFilesRootFolder) {
			return null;
		}
		const result = (await this.client.getMyFilesRootFolder()) as MaybeNode;
		if (!result.ok) {
			return null;
		}
		return this.mapNodeToEntry(result.value);
	}

	async subscribeToEntryChanges(
		eventScopeId: string,
		onEvent: (event: RemoteEntryChangeEvent) => Promise<void>,
	): Promise<{ dispose: () => void }> {
		if (!this.client.subscribeToTreeEvents) {
			throw new Error("Proton Drive SDK does not expose tree events.");
		}
		const subscription = await this.client.subscribeToTreeEvents(
			eventScopeId,
			async (event: unknown) => {
				const normalized = this.normalizeRemoteEvent(event);
				await onEvent(normalized);
			},
		);
		return subscription;
	}

	async writeFile(
		path: string,
		data: Uint8Array,
		metadata?: { mtimeMs?: number; size?: number },
	): Promise<{ id?: string; revisionId?: string }> {
		const getFileUploader = this.client.getFileUploader?.bind(this.client);
		const getFileRevisionUploader = this.client.getFileRevisionUploader?.bind(this.client);
		if (!getFileUploader || !getFileRevisionUploader) {
			throw new Error("Proton Drive SDK does not expose file write methods.");
		}
		const normalized = normalizePath(path);
		const parentPath = dirname(normalized);
		const name = basename(normalized);
		const parentId = await this.ensureRemoteFolder(parentPath);
		const existingFile = await this.findChildByName(parentId, name, "file");
		const existingFolder = await this.findChildByName(parentId, name, "folder");
		const mediaType = inferMediaType(name);

		const uploadMetadata = {
			mediaType,
			expectedSize: metadata?.size ?? data.byteLength,
			modificationTime: metadata?.mtimeMs ? new Date(metadata.mtimeMs) : undefined,
		};
		const blob = new Blob([data.slice().buffer], {
			type: mediaType,
		});
		const uploadRevision = async (fileId: string) => {
			const uploader = await getFileRevisionUploader(fileId, uploadMetadata);
			const controller = await uploader.uploadFromStream(blob.stream(), []);
			const result = await controller.completion();
			return { id: result.nodeUid, revisionId: result.nodeRevisionUid };
		};
		const uploadNewFile = async () => {
			const uploader = await getFileUploader(parentId, name, uploadMetadata);
			const controller = await uploader.uploadFromStream(blob.stream(), []);
			const result = await controller.completion();
			return { id: result.nodeUid, revisionId: result.nodeRevisionUid };
		};

		if (existingFolder?.id && !existingFile?.id) {
			throw new Error(`Remote path conflict: folder exists at ${normalized}`);
		}
		if (existingFile?.id) {
			try {
				return await uploadRevision(existingFile.id);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (!isNotFoundError(message)) {
					throw error;
				}
			}
		}

		try {
			return await uploadNewFile();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!isAlreadyExistsError(message)) {
				throw error;
			}
			const latestFile = await this.findChildByName(parentId, name, "file");
			if (!latestFile?.id) {
				throw error;
			}
			return uploadRevision(latestFile.id);
		}
	}

	async readFile(id: string): Promise<Uint8Array> {
		if (!this.client.getFileDownloader) {
			throw new Error("Proton Drive SDK does not expose file read methods.");
		}
		const downloader = await this.client.getFileDownloader(id);
		const chunks: Uint8Array[] = [];
		const stream = new WritableStream<Uint8Array>({
			write(chunk) {
				chunks.push(chunk);
			},
		});
		const controller = downloader.downloadToStream(stream);
		await controller.completion();
		const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
		const combined = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return combined;
	}

	async deleteEntry(id: string): Promise<void> {
		if (!this.client.trashNodes) {
			throw new Error("Proton Drive SDK does not expose delete methods.");
		}
		for await (const result of this.client.trashNodes([id])) {
			if (!result.ok) {
				throw new Error("Failed to delete remote node.");
			}
		}
	}

	async moveEntry(id: string, newPath: string): Promise<void> {
		if (!this.client.renameNode || !this.client.moveNodes) {
			throw new Error("Proton Drive SDK does not expose move methods.");
		}
		const normalized = normalizePath(newPath);
		const targetParentPath = dirname(normalized);
		const targetName = basename(normalized);
		const parentId = await this.ensureRemoteFolder(targetParentPath);
		for await (const result of this.client.moveNodes([id], parentId)) {
			if (!result.ok) {
				throw new Error("Failed to move remote node.");
			}
		}
		await this.client.renameNode(id, targetName);
	}

	async ensureFolder(path: string): Promise<{ id?: string }> {
		const normalized = normalizePath(path);
		if (!normalized) {
			return { id: this.remoteFolderId };
		}
		const id = await this.ensureRemoteFolder(normalized);
		return { id };
	}

	private iterateFolderChildren(parentId: string): AsyncIterable<NodeEntity> {
		if (!this.client.iterateFolderChildren) {
			throw new Error("Proton Drive SDK does not expose iterateFolderChildren.");
		}
		const iterator = this.client.iterateFolderChildren(parentId);
		return {
			async *[Symbol.asyncIterator]() {
				for await (const node of iterator) {
					const maybe = node as MaybeNode;
					if (!maybe.ok) {
						continue;
					}
					yield maybe.value;
				}
			},
		};
	}

	private async ensureRemoteFolder(path: string): Promise<string> {
		const normalized = normalizePath(path);
		if (!normalized) {
			return this.remoteFolderId;
		}
		const cached = this.folderIdCache.get(normalized);
		if (cached) {
			return cached;
		}
		const parts = splitPath(normalized);
		let parentId = this.remoteFolderId;
		let builtPath = "";
		for (const part of parts) {
			builtPath = builtPath ? `${builtPath}/${part}` : part;
			const cachedPart = this.folderIdCache.get(builtPath);
			if (cachedPart) {
				parentId = cachedPart;
				continue;
			}
			const existing = await this.findChildByName(parentId, part, "folder");
			if (existing?.id) {
				this.folderIdCache.set(builtPath, existing.id);
				this.folderPathCache.set(existing.id, builtPath);
				parentId = existing.id;
				continue;
			}
			if (!this.client.createFolder) {
				throw new Error("Proton Drive SDK does not expose createFolder.");
			}
			const created = (await this.client.createFolder(parentId, part)) as MaybeNode;
			if (!created.ok) {
				throw new Error("Failed to create remote folder.");
			}
			this.folderIdCache.set(builtPath, created.value.uid);
			this.folderPathCache.set(created.value.uid, builtPath);
			parentId = created.value.uid;
		}
		return parentId;
	}

	private async findChildByName(
		parentId: string,
		name: string,
		type: "file" | "folder",
	): Promise<{ id: string; type: "file" | "folder" } | null> {
		for await (const node of this.iterateFolderChildren(parentId)) {
			if (node.name === name && node.type === type) {
				return { id: node.uid, type };
			}
		}
		return null;
	}

	private mapNodeToEntry(node: NodeEntity): RemoteFileEntry {
		const parentPath = node.parentUid ? (this.folderPathCache.get(node.parentUid) ?? "") : "";
		const relPath = normalizePath(parentPath ? `${parentPath}/${node.name}` : node.name);
		return {
			id: node.uid,
			name: node.name,
			path: relPath,
			type: node.type === "folder" ? "folder" : "file",
			parentId: node.parentUid,
			eventScopeId: node.treeEventScopeId,
			mtimeMs: node.modificationTime?.getTime?.() ?? undefined,
			size: node.activeRevision?.storageSize ?? node.totalStorageSize ?? undefined,
			revisionId: node.activeRevision?.uid,
		};
	}

	private normalizeRemoteEvent(event: unknown): RemoteEntryChangeEvent {
		if (!event || typeof event !== "object") {
			return { type: "tree_refresh" };
		}
		const record = event as Record<string, unknown>;
		const type = record.type;
		if (typeof type !== "string") {
			return { type: "tree_refresh" };
		}
		return {
			type: type as RemoteEntryChangeEvent["type"],
			entryId: typeof record.nodeUid === "string" ? record.nodeUid : undefined,
			parentEntryId:
				typeof record.parentNodeUid === "string" ? record.parentNodeUid : undefined,
			eventScopeId:
				typeof record.treeEventScopeId === "string" ? record.treeEventScopeId : undefined,
			eventId: typeof record.eventId === "string" ? record.eventId : undefined,
		};
	}
}

function isAlreadyExistsError(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		normalized.includes("already exists") ||
		normalized.includes("file or folder with that name already exists")
	);
}

function isNotFoundError(message: string): boolean {
	const normalized = message.toLowerCase();
	return normalized.includes("not found") || normalized.includes("404");
}
