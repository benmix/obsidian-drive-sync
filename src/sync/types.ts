export type EntryType = "file" | "folder";

export type LocalFileEntry = {
	path: string;
	type: EntryType;
	mtimeMs?: number;
	size?: number;
};

export type RemoteFileEntry = {
	id: string;
	name: string;
	path?: string;
	type: EntryType;
	parentId?: string;
	mtimeMs?: number;
	size?: number;
	revisionId?: string;
};

export interface LocalFileSystem {
	listEntries(): Promise<LocalFileEntry[]>;
	listFiles(): Promise<LocalFileEntry[]>;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, data: Uint8Array): Promise<void>;
	deletePath(path: string): Promise<void>;
	movePath(fromPath: string, toPath: string): Promise<void>;
	createFolder(path: string): Promise<void>;
	stat(path: string): Promise<{ mtimeMs?: number; size?: number } | null>;
}

export interface RemoteFileSystem {
	listEntries(): Promise<RemoteFileEntry[]>;
	listFiles(): Promise<RemoteFileEntry[]>;
	uploadFile(
		path: string,
		data: Uint8Array,
		metadata?: { mtimeMs?: number; size?: number },
	): Promise<{ id?: string; revisionId?: string }>;
	downloadFile(id: string): Promise<Uint8Array>;
	deletePath?(id: string): Promise<void>;
	movePath?(id: string, newPath: string): Promise<void>;
	createFolder?(path: string): Promise<{ id?: string }>;
}
