import type {
	LocalFileEntry,
	LocalFileSystem,
	RemoteFileEntry,
	RemoteFileSystem,
} from "../../src/contracts/filesystem/file-system";
import type { SyncEntry, SyncJob } from "../../src/contracts/data/sync-schema";
import type { SyncState } from "../../src/contracts/sync/state";

export const FIXED_NOW = 1_700_000_000_000;

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

export function createLocalFileSystem(entries: LocalFileEntry[]): LocalFileSystem {
	return {
		listEntries: async () => entries,
		listFileEntries: async () => entries.filter((entry) => entry.type === "file"),
		listFolderEntries: async () => entries.filter((entry) => entry.type === "folder"),
		getEntry: async (path: string) => {
			const entry = entries.find((candidate) => candidate.path === path);
			return entry ?? null;
		},
		readFile: async () => new Uint8Array(),
		writeFile: async () => undefined,
		deleteEntry: async () => undefined,
		moveEntry: async () => undefined,
		ensureFolder: async () => undefined,
	};
}

export function createRemoteFileSystem(entries: RemoteFileEntry[]): RemoteFileSystem {
	return {
		listEntries: async () => entries,
		listFileEntries: async () => entries.filter((entry) => entry.type === "file"),
		listFolderEntries: async () => entries.filter((entry) => entry.type === "folder"),
		writeFile: async () => ({
			id: "remote-uploaded",
			revisionId: "rev-next",
		}),
		readFile: async () => new Uint8Array(),
	};
}
