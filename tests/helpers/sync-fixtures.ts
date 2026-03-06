import type {
	LocalFileEntry,
	LocalFileSystem,
	RemoteFileEntry,
	RemoteFileSystem,
} from "../../src/filesystem/contracts";
import type { SyncEntry, SyncJob } from "../../src/data/sync-schema";
import type { SyncState } from "../../src/sync/state/index-store";

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
		listFiles: async () => entries.filter((entry) => entry.type === "file"),
		readFile: async () => new Uint8Array(),
		writeFile: async () => undefined,
		deletePath: async () => undefined,
		movePath: async () => undefined,
		createFolder: async () => undefined,
		stat: async (path: string) => {
			const entry = entries.find((candidate) => candidate.path === path);
			if (!entry) {
				return null;
			}
			return { mtimeMs: entry.mtimeMs, size: entry.size };
		},
	};
}

export function createRemoteFileSystem(entries: RemoteFileEntry[]): RemoteFileSystem {
	return {
		listEntries: async () => entries,
		listFiles: async () => entries.filter((entry) => entry.type === "file"),
		uploadFile: async () => ({
			id: "remote-uploaded",
			revisionId: "rev-next",
		}),
		downloadFile: async () => new Uint8Array(),
	};
}
