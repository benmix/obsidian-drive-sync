import type { SyncEntry, SyncJob } from "@contracts/data/sync-schema";
import type {
	LocalFileEntry,
	LocalFileSystem,
	RemoteFileEntry,
	RemoteFileSystem,
} from "@contracts/filesystem/file-system";
import type { SyncState } from "@contracts/sync/state";

export const FIXED_NOW = 1_700_000_000_000;
const encoder = new TextEncoder();

type FileContentMap = Record<string, Uint8Array>;

export function createEntry(overrides: Partial<SyncEntry> = {}): SyncEntry {
	return {
		relPath: "notes/a.md",
		type: "file",
		remoteId: "remote-a",
		remoteRev: "rev-a",
		syncedRemoteRev: "rev-a",
		...overrides,
	};
}

export function createJob(overrides: Partial<SyncJob> = {}): SyncJob {
	return {
		id: "job-1",
		op: "upload",
		path: "notes/a.md",
		entryType: "file",
		priority: 5,
		attempt: 0,
		nextRunAt: FIXED_NOW,
		...overrides,
	};
}

export function createState(entries: SyncEntry[] = []): SyncState {
	return {
		entries: Object.fromEntries(entries.map((entry) => [entry.relPath, entry])),
		jobs: [],
		logs: [],
		runtimeMetrics: {},
	};
}

export function textBytes(value: string): Uint8Array {
	return encoder.encode(value);
}

export function createLocalFileSystem(
	entries: LocalFileEntry[],
	contentsByPath: FileContentMap = {},
): LocalFileSystem {
	return {
		listEntries: async () => entries,
		listFileEntries: async () => entries.filter((entry) => entry.type === "file"),
		listFolderEntries: async () => entries.filter((entry) => entry.type === "folder"),
		getEntry: async (path: string) => {
			const entry = entries.find((candidate) => candidate.path === path);
			return entry ?? null;
		},
		readFile: async (path: string) => contentsByPath[path] ?? textBytes(`local:${path}`),
		writeFile: async () => {},
		deleteEntry: async () => {},
		moveEntry: async () => {},
		ensureFolder: async () => {},
	};
}

export function createRemoteFileSystem(
	entries: RemoteFileEntry[],
	contentsById: FileContentMap = {},
): RemoteFileSystem {
	return {
		listEntries: async () => entries,
		listFileEntries: async () => entries.filter((entry) => entry.type === "file"),
		listFolderEntries: async () => entries.filter((entry) => entry.type === "folder"),
		getEntry: async (id: string) => {
			const entry = entries.find((candidate) => candidate.id === id);
			return entry ?? null;
		},
		writeFile: async () => ({
			id: "remote-uploaded",
			revisionId: "rev-next",
		}),
		readFile: async (id: string) => contentsById[id] ?? textBytes(`remote:${id}`),
	};
}
