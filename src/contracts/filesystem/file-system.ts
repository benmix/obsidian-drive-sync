import type { EntryType } from "./entry";

export type EntryMetadata = {
	mtimeMs?: number;
	size?: number;
};

export type LocalFileEntry = EntryMetadata & {
	path: string;
	type: EntryType;
};

export type LocalChange =
	| { type: "create"; path: string; entryType: EntryType }
	| { type: "modify"; path: string; entryType: EntryType }
	| { type: "delete"; path: string; entryType: EntryType }
	| {
			type: "rename";
			from: string;
			to: string;
			entryType: EntryType;
	  };

export type RemoteFileEntry = EntryMetadata & {
	id: string;
	name: string;
	path?: string;
	type: EntryType;
	parentId?: string;
	eventScopeId?: string;
	revisionId?: string;
};

export interface LocalFileSystem {
	listEntries(): Promise<LocalFileEntry[]>;
	listFileEntries(): Promise<LocalFileEntry[]>;
	listFolderEntries(): Promise<LocalFileEntry[]>;
	getEntry(path: string): Promise<LocalFileEntry | null>;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, data: Uint8Array, metadata?: EntryMetadata): Promise<void>;
	deleteEntry(path: string): Promise<void>;
	moveEntry(fromPath: string, toPath: string): Promise<void>;
	ensureFolder(path: string): Promise<void>;
}

export interface RemoteFileSystem {
	listEntries(): Promise<RemoteFileEntry[]>;
	listFileEntries(): Promise<RemoteFileEntry[]>;
	listFolderEntries(): Promise<RemoteFileEntry[]>;
	listChildFolderEntries?(): Promise<RemoteFileEntry[]>;
	getEntry(entryId: string): Promise<RemoteFileEntry | null>;
	readFile(entryId: string): Promise<Uint8Array>;
	writeFile(
		path: string,
		data: Uint8Array,
		metadata?: EntryMetadata,
	): Promise<{ id?: string; revisionId?: string }>;
	deleteEntry?(entryId: string): Promise<void>;
	moveEntry?(entryId: string, newPath: string): Promise<void>;
	ensureFolder?(path: string): Promise<{ id?: string }>;
	subscribeToEntryChanges?(
		eventScopeId: string,
		onEvent: (event: RemoteEntryChangeEvent) => Promise<void>,
	): Promise<{ dispose: () => void }>;
	getRootEntry?(): Promise<RemoteFileEntry | null>;
}

export type RemoteEntryChangeEvent = {
	type:
		| "node_created"
		| "node_updated"
		| "node_deleted"
		| "tree_refresh"
		| "tree_remove"
		| "fast_forward"
		| "shared_with_me_updated";
	entryId?: string;
	parentEntryId?: string;
	eventScopeId?: string;
	eventId?: string;
};
