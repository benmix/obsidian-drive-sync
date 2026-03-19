export type ProtonDriveSdkApi = {
	getLatestEventId?: (eventScopeId: string) => string | null;
	setLatestEventId?: (eventScopeId: string, eventId?: string) => void;
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

export type ProtonDriveSdkClient = ProtonDriveSdkApi & {
	sdk?: ProtonDriveSdkApi;
};

export type ProtonDriveNodeEntity = {
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

export type ProtonDriveMaybeNode =
	| { ok: true; value: ProtonDriveNodeEntity }
	| { ok: false; error: unknown };

export type ProtonRootNodeResult =
	| { ok: true; value: { uid: string; name: string } }
	| { ok: false; error?: unknown };
