export type LocalFileEntry = {
	path: string;
	mtimeMs: number;
	size: number;
};

export type RemoteFileEntry = {
	id: string;
	name: string;
	mtimeMs?: number;
	size?: number;
	revisionId?: string;
};

export interface LocalFileSystem {
	listFiles(): Promise<LocalFileEntry[]>;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, data: Uint8Array): Promise<void>;
	deletePath(path: string): Promise<void>;
	movePath(fromPath: string, toPath: string): Promise<void>;
}

export interface RemoteFileSystem {
	listFiles(): Promise<RemoteFileEntry[]>;
	uploadFile(path: string, data: Uint8Array): Promise<void>;
	downloadFile(id: string): Promise<Uint8Array>;
	deletePath?(id: string): Promise<void>;
	movePath?(id: string, newName: string): Promise<void>;
}
