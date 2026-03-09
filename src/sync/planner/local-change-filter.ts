import type {
	LocalChange,
	LocalFileEntry,
	LocalFileSystem,
} from "../../contracts/filesystem/file-system";
import type { SyncState } from "../../contracts/sync/state";
import { normalizePath } from "../../filesystem/path";
import { hashBytes } from "../support/hash";

export async function filterLocalChanges(
	changes: LocalChange[],
	state: SyncState,
	localFileSystem: LocalFileSystem,
): Promise<LocalChange[]> {
	const filtered: LocalChange[] = [];
	const entryCache = new Map<string, Promise<LocalFileEntry | null>>();
	const hashCache = new Map<string, Promise<string>>();

	const getEntry = (path: string): Promise<LocalFileEntry | null> => {
		const normalized = normalizePath(path);
		const cached = entryCache.get(normalized);
		if (cached) {
			return cached;
		}
		const next = localFileSystem.getEntry(normalized);
		entryCache.set(normalized, next);
		return next;
	};

	const getHash = (path: string): Promise<string> => {
		const normalized = normalizePath(path);
		const cached = hashCache.get(normalized);
		if (cached) {
			return cached;
		}
		const next = localFileSystem.readFile(normalized).then((bytes) => hashBytes(bytes));
		hashCache.set(normalized, next);
		return next;
	};

	for (const change of changes) {
		if (change.type === "rename") {
			const renamed = await getEntry(change.to);
			if (renamed) {
				filtered.push(change);
			}
			continue;
		}

		const path = normalizePath(change.path);
		const prior = state.entries[path];

		if (change.type === "delete") {
			const current = await getEntry(path);
			if (!current) {
				filtered.push(change);
			}
			continue;
		}

		const current = await getEntry(path);
		if (!current) {
			continue;
		}

		if (change.entryType === "folder") {
			if (change.type === "modify") {
				continue;
			}
			if (!prior || prior.tombstone) {
				filtered.push(change);
			}
			continue;
		}

		if (!prior || prior.tombstone || prior.type !== "file") {
			filtered.push(change);
			continue;
		}

		if (!matchesTrackedLocalMetadata(prior, current)) {
			filtered.push(change);
			continue;
		}

		if (!prior.syncedLocalHash) {
			continue;
		}

		const localHash = await getHash(path);
		if (localHash !== prior.syncedLocalHash) {
			filtered.push(change);
		}
	}

	return filtered;
}

function matchesTrackedLocalMetadata(
	prior: SyncState["entries"][string],
	current: LocalFileEntry,
): boolean {
	return (
		prior.type === current.type &&
		typeof prior.localMtimeMs === "number" &&
		typeof current.mtimeMs === "number" &&
		prior.localMtimeMs === current.mtimeMs &&
		typeof prior.localSize === "number" &&
		typeof current.size === "number" &&
		prior.localSize === current.size
	);
}
