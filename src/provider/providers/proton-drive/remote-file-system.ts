import type {
	RemoteEntryChangeEvent,
	RemoteFileEntry,
	RemoteFileSystem,
} from "@contracts/filesystem/file-system";
import type {
	ProtonDriveMaybeNode,
	ProtonDriveNodeEntity,
	ProtonDriveSdkApi,
	ProtonDriveSdkClient,
} from "@contracts/provider/proton/drive-sdk";
import {
	createDriveSyncError,
	type DriveSyncErrorCode,
	type ErrorCategory,
	isNotFoundDriveSyncError,
	normalizeUnknownDriveSyncError,
} from "@errors";
import { basename, dirname, normalizePath, splitPath } from "@filesystem/path";
import mimeTypes from "mime-types";

const DEFAULT_MEDIA_TYPE = "application/octet-stream";

function inferMediaType(fileName: string): string {
	const mediaType = mimeTypes.lookup(fileName);
	return typeof mediaType === "string" ? mediaType : DEFAULT_MEDIA_TYPE;
}

export class ProtonDriveRemoteFileSystem implements RemoteFileSystem {
	private client: ProtonDriveSdkClient;
	private scopeRootId: string;
	private folderPathCache = new Map<string, string>();
	private folderIdCache = new Map<string, string>();

	constructor(client: ProtonDriveSdkClient, scopeRootId: string) {
		this.client = client;
		this.scopeRootId = scopeRootId;
		this.primeScopeRootCache();
	}

	private get sdkClient(): ProtonDriveSdkApi {
		return this.client.sdk ?? this.client;
	}

	async listEntries(): Promise<RemoteFileEntry[]> {
		const entries: RemoteFileEntry[] = [];
		const queue: Array<{ id: string; path: string }> = [{ id: this.scopeRootId, path: "" }];
		this.primeScopeRootCache();

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) {
				continue;
			}
			for await (const node of this.iterateFolderChildren(current.id)) {
				const relPath = normalizePath(
					current.path ? `${current.path}/${node.name}` : node.name,
				);
				const entry = this.createRemoteEntry(node, relPath, node.parentUid ?? current.id);
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
		this.primeScopeRootCache();

		for await (const node of this.iterateFolderChildren(this.scopeRootId)) {
			if (node.type !== "folder") {
				continue;
			}

			const relPath = normalizePath(node.name);
			const entry = this.createRemoteEntry(node, relPath, node.parentUid ?? this.scopeRootId);
			entries.push(entry);
			this.folderPathCache.set(entry.id, relPath);
			this.folderIdCache.set(relPath, entry.id);
		}

		return entries;
	}

	async getEntry(id: string): Promise<RemoteFileEntry | null> {
		if (!this.sdkClient.getNode) {
			return null;
		}
		const node = await this.getNodeEntity(id, {
			code: "REMOTE_WRITE_FAILED",
			category: "remote_fs",
			userMessage: "Failed to load remote item.",
			debugMessage: "Failed to load remote node.",
			details: { nodeId: id },
		});
		if (!node) {
			return null;
		}
		const relPath = await this.resolveScopedPath(node);
		if (relPath === null) {
			return null;
		}
		return this.createRemoteEntry(node, relPath);
	}

	async getRootEntry(): Promise<RemoteFileEntry | null> {
		return await this.getEntry(this.scopeRootId);
	}

	async subscribeToEntryChanges(
		eventScopeId: string,
		onEvent: (event: RemoteEntryChangeEvent) => Promise<void>,
	): Promise<{ dispose: () => void }> {
		if (!this.sdkClient.subscribeToTreeEvents) {
			throw unsupportedRemoteOperationError("tree events");
		}
		const subscription = await this.sdkClient.subscribeToTreeEvents(
			eventScopeId,
			async (event: unknown) => {
				const normalized = this.normalizeRemoteEvent(event);
				if (normalized.eventId) {
					this.setLatestEventCursor(eventScopeId, normalized.eventId);
				}
				await onEvent(normalized);
			},
		);
		return subscription;
	}

	setLatestEventCursor(eventScopeId: string, eventId?: string): void {
		this.client.setLatestEventId?.(eventScopeId, eventId);
	}

	getLatestEventCursor(eventScopeId: string): string | null {
		return this.client.getLatestEventId?.(eventScopeId) ?? null;
	}

	async writeFile(
		path: string,
		data: Uint8Array,
		metadata?: { mtimeMs?: number; size?: number },
	): Promise<{ id?: string; revisionId?: string }> {
		const getFileUploader = this.sdkClient.getFileUploader?.bind(this.sdkClient);
		const getFileRevisionUploader = this.sdkClient.getFileRevisionUploader?.bind(
			this.sdkClient,
		);
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
		if (!this.sdkClient.getFileDownloader) {
			throw unsupportedRemoteOperationError("file read");
		}
		try {
			const downloader = await this.sdkClient.getFileDownloader(id);
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
		} catch (error) {
			throw mapRemoteOperationError(error, {
				code: "REMOTE_WRITE_FAILED",
				category: "remote_fs",
				userMessage: "Failed to read remote file.",
				debugMessage: "Failed to download remote file.",
				details: { nodeId: id },
			});
		}
	}

	async deleteEntry(id: string): Promise<void> {
		if (!this.sdkClient.trashNodes) {
			throw unsupportedRemoteOperationError("delete");
		}
		for await (const result of this.sdkClient.trashNodes([id])) {
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
		if (!this.sdkClient.renameNode || !this.sdkClient.moveNodes) {
			throw unsupportedRemoteOperationError("move");
		}
		const node = await this.getNodeEntity(id, {
			code: "REMOTE_WRITE_FAILED",
			category: "remote_fs",
			userMessage: "Remote move failed.",
			debugMessage: "Failed to load remote node before move.",
			details: { nodeId: id, path: newPath },
		});
		if (!node) {
			throw createDriveSyncError("REMOTE_NOT_FOUND", {
				category: "remote_fs",
				userMessage: "Remote item not found.",
				details: { nodeId: id, path: newPath },
			});
		}
		const normalized = normalizePath(newPath);
		const targetParentPath = dirname(normalized);
		const targetName = basename(normalized);
		const parentId = await this.ensureRemoteFolder(targetParentPath);
		const originalParentId = node.parentUid ?? this.scopeRootId;
		const needsMove = originalParentId !== parentId;
		const needsRename = node.name !== targetName;
		if (!needsMove && !needsRename) {
			return;
		}

		const conflict = await this.findConflictingChildId(parentId, targetName, id);
		if (conflict) {
			throw createDriveSyncError("REMOTE_PATH_CONFLICT", {
				category: "remote_fs",
				userMessage: "Remote path conflict detected.",
				details: { nodeId: id, path: normalized, conflictId: conflict },
			});
		}

		if (needsMove) {
			await this.moveNode(id, parentId, {
				path: normalized,
				parentId,
				originalParentId,
			});
		}
		if (!needsRename) {
			return;
		}

		try {
			await this.sdkClient.renameNode(id, targetName);
		} catch (error) {
			if (needsMove) {
				const rollbackError = await this.rollbackMovedNode(id, originalParentId, node.name);
				if (rollbackError) {
					throw createDriveSyncError("REMOTE_WRITE_FAILED", {
						category: "remote_fs",
						userMessage: "Remote move failed.",
						debugMessage:
							"Failed to rename remote node after move, and rollback was unsuccessful.",
						details: {
							nodeId: id,
							path: normalized,
							parentId,
							originalParentId,
							rollbackError: extractErrorMessage(rollbackError),
						},
						cause: error,
					});
				}
			}
			throw mapRemoteOperationError(error, {
				code: "REMOTE_WRITE_FAILED",
				category: "remote_fs",
				userMessage: "Remote move failed.",
				debugMessage: "Failed to rename remote node after move.",
				details: {
					nodeId: id,
					path: normalized,
					parentId,
					originalParentId,
				},
			});
		}
	}

	async ensureFolder(path: string): Promise<{ id?: string }> {
		const normalized = normalizePath(path);
		if (!normalized) {
			return { id: this.scopeRootId };
		}
		const id = await this.ensureRemoteFolder(normalized);
		return { id };
	}

	private iterateFolderChildren(parentId: string): AsyncIterable<ProtonDriveNodeEntity> {
		if (!this.sdkClient.iterateFolderChildren) {
			throw unsupportedRemoteOperationError("iterate folder children");
		}
		const iterator = this.sdkClient.iterateFolderChildren(parentId);
		return {
			async *[Symbol.asyncIterator]() {
				for await (const node of iterator) {
					const maybe = node as ProtonDriveMaybeNode;
					if (!maybe.ok) {
						throw mapRemoteOperationError(maybe.error, {
							code: "REMOTE_WRITE_FAILED",
							category: "remote_fs",
							userMessage: "Failed to list remote folder.",
							debugMessage: "Failed to iterate remote folder children.",
							details: { parentId },
						});
					}
					yield maybe.value;
				}
			},
		};
	}

	private primeScopeRootCache(): void {
		this.folderIdCache.set("", this.scopeRootId);
		this.folderPathCache.set(this.scopeRootId, "");
	}

	private async getNodeEntity(
		nodeId: string,
		mapping: {
			code: DriveSyncErrorCode;
			category: ErrorCategory;
			userMessage: string;
			debugMessage?: string;
			details?: Record<string, unknown>;
		},
	): Promise<ProtonDriveNodeEntity | null> {
		if (!this.sdkClient.getNode) {
			return null;
		}
		const result = (await this.sdkClient.getNode(nodeId)) as ProtonDriveMaybeNode;
		if (result.ok) {
			return result.value;
		}
		const normalized = mapRemoteOperationError(result.error, mapping);
		if (isNotFoundDriveSyncError(normalized)) {
			return null;
		}
		throw normalized;
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
			if (!this.sdkClient.createFolder) {
				throw unsupportedRemoteOperationError("create folder");
			}
			const created = (await this.sdkClient.createFolder(
				parentId,
				part,
			)) as ProtonDriveMaybeNode;
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

	private async findConflictingChildId(
		parentId: string,
		name: string,
		nodeId: string,
	): Promise<string | null> {
		const fileMatch = await this.findChildByName(parentId, name, "file");
		if (fileMatch?.id && fileMatch.id !== nodeId) {
			return fileMatch.id;
		}
		const folderMatch = await this.findChildByName(parentId, name, "folder");
		if (folderMatch?.id && folderMatch.id !== nodeId) {
			return folderMatch.id;
		}
		return null;
	}

	private async moveNode(
		nodeId: string,
		parentId: string,
		context: {
			path: string;
			parentId: string;
			originalParentId?: string;
		},
	): Promise<void> {
		for await (const result of this.sdkClient.moveNodes?.([nodeId], parentId) ?? []) {
			if (!result.ok) {
				throw mapRemoteOperationError(result.error, {
					code: "REMOTE_WRITE_FAILED",
					category: "remote_fs",
					userMessage: "Remote move failed.",
					debugMessage: "Failed to move remote node.",
					details: {
						nodeId,
						path: context.path,
						parentId: context.parentId,
						originalParentId: context.originalParentId,
					},
				});
			}
		}
	}

	private async rollbackMovedNode(
		nodeId: string,
		originalParentId: string,
		_originalName: string,
	): Promise<unknown | null> {
		try {
			await this.moveNode(nodeId, originalParentId, {
				path: "",
				parentId: originalParentId,
			});
			return null;
		} catch (error) {
			return error;
		}
	}

	private async resolveScopedPath(
		node: ProtonDriveNodeEntity,
		visited = new Set<string>(),
	): Promise<string | null> {
		if (node.uid === this.scopeRootId) {
			this.primeScopeRootCache();
			return "";
		}
		if (visited.has(node.uid)) {
			throw createDriveSyncError("REMOTE_WRITE_FAILED", {
				category: "remote_fs",
				userMessage: "Failed to resolve remote path.",
				debugMessage: "Detected cyclic remote parent chain.",
				details: { nodeId: node.uid },
			});
		}
		visited.add(node.uid);
		if (!node.parentUid) {
			return null;
		}
		const cachedParentPath = this.folderPathCache.get(node.parentUid);
		if (cachedParentPath !== undefined) {
			return normalizePath(cachedParentPath ? `${cachedParentPath}/${node.name}` : node.name);
		}
		const parentNode = await this.getNodeEntity(node.parentUid, {
			code: "REMOTE_WRITE_FAILED",
			category: "remote_fs",
			userMessage: "Failed to resolve remote path.",
			debugMessage: "Failed to load parent remote node.",
			details: { nodeId: node.uid, parentId: node.parentUid },
		});
		if (!parentNode) {
			return null;
		}
		const parentPath = await this.resolveScopedPath(parentNode, visited);
		if (parentPath === null) {
			return null;
		}
		if (parentNode.type === "folder") {
			this.folderPathCache.set(parentNode.uid, parentPath);
			this.folderIdCache.set(parentPath, parentNode.uid);
		}
		return normalizePath(parentPath ? `${parentPath}/${node.name}` : node.name);
	}

	private createRemoteEntry(
		node: ProtonDriveNodeEntity,
		relPath: string,
		parentId = node.parentUid,
	): RemoteFileEntry {
		return {
			id: node.uid,
			name: node.name,
			path: relPath,
			type: node.type === "folder" ? "folder" : "file",
			parentId,
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
	if (status === 401 || status === 403) {
		return {
			code: "AUTH_REAUTH_REQUIRED",
			category: "auth",
			userMessage: "Authentication required. Sign in again to continue.",
			userMessageKey: "error.auth.reauthRequired",
		};
	}
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
	if (error instanceof Error && error.name === "AbortError") {
		return {
			code: "NETWORK_TIMEOUT",
			category: "network",
			retryable: true,
			userMessage: "Network request timed out. The sync will retry automatically.",
			userMessageKey: "error.network.timeout",
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

	if (
		normalized.includes("timed out") ||
		normalized.includes("timeout") ||
		normalized.includes("aborted")
	) {
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

function getNodeMtimeMs(node: ProtonDriveNodeEntity): number | undefined {
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
