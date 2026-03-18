import mimeTypes from "mime-types";

import type {
	RemoteEntryChangeEvent,
	RemoteFileEntry,
	RemoteFileSystem,
} from "../../../contracts/filesystem/file-system";
import {
	createDriveSyncError,
	type DriveSyncErrorCode,
	type ErrorCategory,
	isNotFoundDriveSyncError,
	normalizeUnknownDriveSyncError,
} from "../../../errors";
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
			resume?: () => void;
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
			resume?: () => void;
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
	private scopeRootId: string;
	private folderPathCache = new Map<string, string>();
	private folderIdCache = new Map<string, string>();

	constructor(client: ProtonDriveClient, scopeRootId: string) {
		this.client = client;
		this.scopeRootId = scopeRootId;
	}

	async listEntries(): Promise<RemoteFileEntry[]> {
		const entries: RemoteFileEntry[] = [];
		const queue: Array<{ id: string; path: string }> = [{ id: this.scopeRootId, path: "" }];
		this.folderIdCache.set("", this.scopeRootId);
		this.folderPathCache.set(this.scopeRootId, "");

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
					mtimeMs: getNodeMtimeMs(node),
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

	async listChildFolderEntries(): Promise<RemoteFileEntry[]> {
		const entries: RemoteFileEntry[] = [];
		this.folderIdCache.set("", this.scopeRootId);
		this.folderPathCache.set(this.scopeRootId, "");

		for await (const node of this.iterateFolderChildren(this.scopeRootId)) {
			if (node.type !== "folder") {
				continue;
			}

			const relPath = normalizePath(node.name);
			const entry: RemoteFileEntry = {
				id: node.uid,
				name: node.name,
				path: relPath,
				type: "folder",
				parentId: node.parentUid ?? this.scopeRootId,
				eventScopeId: node.treeEventScopeId,
				mtimeMs: getNodeMtimeMs(node),
				size: node.activeRevision?.storageSize ?? node.totalStorageSize ?? undefined,
				revisionId: node.activeRevision?.uid,
			};
			entries.push(entry);
			this.folderPathCache.set(entry.id, relPath);
			this.folderIdCache.set(relPath, entry.id);
		}

		return entries;
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
			throw unsupportedRemoteOperationError("tree events");
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
			throw unsupportedRemoteOperationError("file write");
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
			try {
				const result = await controller.completion();
				return {
					id: result.nodeUid,
					revisionId: result.nodeRevisionUid,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (!isDraftRevisionExistsError(message)) {
					throw error;
				}
				if (controller.resume) {
					controller.resume();
					const resumed = await controller.completion();
					return {
						id: resumed.nodeUid,
						revisionId: resumed.nodeRevisionUid,
					};
				}
				throw error;
			}
		};
		const uploadNewFile = async () => {
			const uploader = await getFileUploader(parentId, name, uploadMetadata);
			const controller = await uploader.uploadFromStream(blob.stream(), []);
			const result = await controller.completion();
			return { id: result.nodeUid, revisionId: result.nodeRevisionUid };
		};

		if (existingFolder?.id && !existingFile?.id) {
			throw createDriveSyncError("REMOTE_PATH_CONFLICT", {
				category: "remote_fs",
				userMessage: "Remote path conflict detected.",
				details: { path: normalized },
			});
		}
		if (existingFile?.id) {
			for (let attempt = 1; attempt <= 3; attempt += 1) {
				try {
					return await uploadRevision(existingFile.id);
				} catch (error) {
					if (
						isNotFoundDriveSyncError(
							mapRemoteOperationError(error, {
								code: "REMOTE_WRITE_FAILED",
								category: "remote_fs",
								userMessage: "Remote write failed.",
								details: {
									path: normalized,
									attempt,
									fileId: existingFile.id,
								},
							}),
						)
					) {
						break;
					}
					if (isDraftRevisionExistsError(error) && attempt < 3) {
						await waitMs(250 * attempt);
						continue;
					}
					throw mapRemoteOperationError(error, {
						code: "REMOTE_WRITE_FAILED",
						category: "remote_fs",
						userMessage: "Remote write failed.",
						details: {
							path: normalized,
							attempt,
							fileId: existingFile.id,
						},
					});
				}
			}
		}

		try {
			return await uploadNewFile();
		} catch (error) {
			if (!isAlreadyExistsError(error)) {
				throw mapRemoteOperationError(error, {
					code: "REMOTE_WRITE_FAILED",
					category: "remote_fs",
					userMessage: "Remote write failed.",
					details: { path: normalized, parentId },
				});
			}
			const latestFile = await this.findChildByName(parentId, name, "file");
			if (!latestFile?.id) {
				throw createDriveSyncError("REMOTE_ALREADY_EXISTS", {
					category: "remote_fs",
					userMessage: "Remote path conflict detected.",
					details: { path: normalized, parentId },
					cause: error,
				});
			}
			return uploadRevision(latestFile.id);
		}
	}

	async readFile(id: string): Promise<Uint8Array> {
		if (!this.client.getFileDownloader) {
			throw unsupportedRemoteOperationError("file read");
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
			throw unsupportedRemoteOperationError("delete");
		}
		for await (const result of this.client.trashNodes([id])) {
			if (!result.ok) {
				const detail = extractErrorMessage(result.error);
				if (
					isNotFoundDriveSyncError(
						mapRemoteOperationError(result.error, {
							code: "REMOTE_WRITE_FAILED",
							category: "remote_fs",
							userMessage: "Remote delete failed.",
							debugMessage: detail || "Failed to delete remote node.",
							details: { nodeId: id },
						}),
					) ||
					isAlreadyDeletedError(result.error)
				) {
					return;
				}
				throw mapRemoteOperationError(result.error, {
					code: "REMOTE_WRITE_FAILED",
					category: "remote_fs",
					userMessage: "Remote delete failed.",
					debugMessage: detail || "Failed to delete remote node.",
					details: { nodeId: id },
				});
			}
		}
	}

	async moveEntry(id: string, newPath: string): Promise<void> {
		if (!this.client.renameNode || !this.client.moveNodes) {
			throw unsupportedRemoteOperationError("move");
		}
		const normalized = normalizePath(newPath);
		const targetParentPath = dirname(normalized);
		const targetName = basename(normalized);
		const parentId = await this.ensureRemoteFolder(targetParentPath);
		for await (const result of this.client.moveNodes([id], parentId)) {
			if (!result.ok) {
				throw mapRemoteOperationError(result.error, {
					code: "REMOTE_WRITE_FAILED",
					category: "remote_fs",
					userMessage: "Remote move failed.",
					debugMessage: "Failed to move remote node.",
					details: { nodeId: id, path: normalized, parentId },
				});
			}
		}
		await this.client.renameNode(id, targetName);
	}

	async ensureFolder(path: string): Promise<{ id?: string }> {
		const normalized = normalizePath(path);
		if (!normalized) {
			return { id: this.scopeRootId };
		}
		const id = await this.ensureRemoteFolder(normalized);
		return { id };
	}

	private iterateFolderChildren(parentId: string): AsyncIterable<NodeEntity> {
		if (!this.client.iterateFolderChildren) {
			throw unsupportedRemoteOperationError("iterate folder children");
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
			return this.scopeRootId;
		}
		const cached = this.folderIdCache.get(normalized);
		if (cached) {
			return cached;
		}
		const parts = splitPath(normalized);
		let parentId = this.scopeRootId;
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
				throw unsupportedRemoteOperationError("create folder");
			}
			const created = (await this.client.createFolder(parentId, part)) as MaybeNode;
			if (!created.ok) {
				throw mapRemoteOperationError(created.error, {
					code: "REMOTE_WRITE_FAILED",
					category: "remote_fs",
					userMessage: "Failed to create folder.",
					debugMessage: "Failed to create remote folder.",
					details: { path: builtPath, parentId },
				});
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
			mtimeMs: getNodeMtimeMs(node),
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

function waitMs(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function unsupportedRemoteOperationError(operation: string) {
	return createDriveSyncError("REMOTE_UNSUPPORTED", {
		category: "provider",
		userMessage: "This remote operation is not supported.",
		details: { operation },
	});
}

function mapRemoteOperationError(
	error: unknown,
	mapping: {
		code: DriveSyncErrorCode;
		category: ErrorCategory;
		userMessage: string;
		debugMessage?: string;
		details?: Record<string, unknown>;
	},
) {
	const classified = classifyProtonRemoteError(error);
	return normalizeUnknownDriveSyncError(error, {
		code: classified?.code ?? mapping.code,
		category: classified?.category ?? mapping.category,
		retryable: classified?.retryable,
		userMessage: classified?.userMessage ?? mapping.userMessage,
		userMessageKey: classified?.userMessageKey,
		debugMessage: mapping.debugMessage,
		details: mapping.details,
	});
}

function classifyProtonRemoteError(error: unknown):
	| {
			code: DriveSyncErrorCode;
			category: ErrorCategory;
			retryable?: boolean;
			userMessage: string;
			userMessageKey: string;
	  }
	| undefined {
	const status = extractStatus(error);
	if (status === 404) {
		return {
			code: "REMOTE_NOT_FOUND",
			category: "remote_fs",
			userMessage: "Remote item not found.",
			userMessageKey: "error.remote.notFound",
		};
	}
	if (status === 408 || status === 425) {
		return {
			code: "NETWORK_TIMEOUT",
			category: "network",
			retryable: true,
			userMessage: "Network request timed out. The sync will retry automatically.",
			userMessageKey: "error.network.timeout",
		};
	}
	if (status === 429) {
		return {
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
			userMessage:
				"Remote provider rate limited requests. The sync will retry automatically.",
			userMessageKey: "error.network.rateLimited",
		};
	}
	if (status !== undefined && status >= 500) {
		return {
			code: "NETWORK_TEMPORARY_FAILURE",
			category: "network",
			retryable: true,
			userMessage: "Temporary network failure. The sync will retry automatically.",
			userMessageKey: "error.network.temporaryFailure",
		};
	}

	const message = extractErrorMessage(error);
	const normalized = message.toLowerCase().trim();
	if (!normalized) {
		return undefined;
	}

	if (
		normalized.includes("session key is missing openpgp metadata") ||
		normalized.includes("missing block file")
	) {
		return {
			code: "REMOTE_TRANSIENT_INCOMPLETE",
			category: "remote_fs",
			retryable: true,
			userMessage: "Remote data is not ready yet. The sync will retry automatically.",
			userMessageKey: "error.remote.transientIncomplete",
		};
	}

	if (normalized.includes("draft revision already exists for this link")) {
		return {
			code: "REMOTE_WRITE_FAILED",
			category: "remote_fs",
			retryable: true,
			userMessage: "Remote write was rejected. The sync will retry automatically.",
			userMessageKey: "error.remote.writeRejectedRetrying",
		};
	}

	if (normalized.includes("not found") || normalized.includes("404")) {
		return {
			code: "REMOTE_NOT_FOUND",
			category: "remote_fs",
			userMessage: "Remote item not found.",
			userMessageKey: "error.remote.notFound",
		};
	}

	if (
		normalized.includes("too many") ||
		normalized.includes("rate limit") ||
		normalized.includes("rate-limited") ||
		normalized.includes("throttle")
	) {
		return {
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
			userMessage:
				"Remote provider rate limited requests. The sync will retry automatically.",
			userMessageKey: "error.network.rateLimited",
		};
	}

	if (normalized.includes("timeout")) {
		return {
			code: "NETWORK_TIMEOUT",
			category: "network",
			retryable: true,
			userMessage: "Network request timed out. The sync will retry automatically.",
			userMessageKey: "error.network.timeout",
		};
	}

	if (
		normalized.includes("network") ||
		normalized.includes("temporar") ||
		normalized.includes("503") ||
		normalized.includes("500") ||
		normalized.includes("failed to fetch")
	) {
		return {
			code: "NETWORK_TEMPORARY_FAILURE",
			category: "network",
			retryable: true,
			userMessage: "Temporary network failure. The sync will retry automatically.",
			userMessageKey: "error.network.temporaryFailure",
		};
	}

	return undefined;
}

function getNodeMtimeMs(node: NodeEntity): number | undefined {
	return (
		node.activeRevision?.claimedModificationTime?.getTime?.() ??
		node.modificationTime?.getTime?.() ??
		undefined
	);
}

function isAlreadyExistsError(error: unknown): boolean {
	const normalized = extractErrorMessage(error).toLowerCase();
	return (
		normalized.includes("already exists") ||
		normalized.includes("file or folder with that name already exists")
	);
}

function isDraftRevisionExistsError(error: unknown): boolean {
	const normalized = extractErrorMessage(error).toLowerCase();
	return (
		normalized.includes("draft revision already exists for this link") ||
		(normalized.includes("draft revision") && normalized.includes("already exists"))
	);
}

function isAlreadyDeletedError(error: unknown): boolean {
	const normalized = extractErrorMessage(error).toLowerCase();
	return (
		normalized.includes("already in trash") ||
		normalized.includes("already trashed") ||
		(normalized.includes("already") && normalized.includes("deleted"))
	);
}

function extractStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object") {
		return undefined;
	}
	const record = error as {
		status?: unknown;
		response?: {
			status?: unknown;
		};
	};
	if (typeof record.status === "number") {
		return record.status;
	}
	if (typeof record.response?.status === "number") {
		return record.response.status;
	}
	return undefined;
}

function extractErrorMessage(error: unknown): string {
	if (!error) {
		return "";
	}
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	if (typeof error === "object") {
		const record = error as Record<string, unknown>;
		if (typeof record.message === "string") {
			return record.message;
		}
		if (typeof record.error === "string") {
			return record.error;
		}
		if (typeof record.details === "string") {
			return record.details;
		}
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	return String(error);
}
