import type { LocalFileSystem, RemoteFileSystem } from "./types";
import type { SyncEntry, SyncJob, SyncState } from "./index-types";
import { normalizePath, now } from "./utils";

export type ReconcileResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
};

type EntrySnapshot = {
	path: string;
	type: "file" | "folder";
	local?: {
		mtimeMs?: number;
		size?: number;
	};
	remote?: {
		id: string;
		mtimeMs?: number;
		size?: number;
		revisionId?: string;
		parentId?: string;
	};
};

export async function reconcileSnapshot(
	localFs: LocalFileSystem,
	remoteFs: RemoteFileSystem,
	state?: SyncState,
): Promise<ReconcileResult> {
	const localEntries = await localFs.listEntries();
	const remoteEntries = await remoteFs.listEntries();
	const jobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const nowTs = now();

	const byPath: Record<string, EntrySnapshot> = {};

	for (const entry of localEntries) {
		const relPath = normalizePath(entry.path);
		byPath[relPath] = {
			...(byPath[relPath] ?? { path: relPath }),
			type: entry.type,
			local: { mtimeMs: entry.mtimeMs, size: entry.size },
		};
	}

	for (const entry of remoteEntries) {
		const relPath = normalizePath(entry.path ?? entry.name);
		byPath[relPath] = {
			...(byPath[relPath] ?? { path: relPath }),
			remote: {
				id: entry.id,
				mtimeMs: entry.mtimeMs,
				size: entry.size,
				revisionId: entry.revisionId,
				parentId: entry.parentId,
			},
			type: entry.type,
		};
	}

	for (const entry of Object.values(byPath)) {
		const base: SyncEntry = {
			relPath: entry.path,
			type: entry.type,
			localMtimeMs:
				entry.type === "file" ? entry.local?.mtimeMs : undefined,
			localSize: entry.type === "file" ? entry.local?.size : undefined,
			remoteId: entry.remote?.id,
			remoteParentId: entry.remote?.parentId,
			remoteMtimeMs: entry.remote?.mtimeMs,
			remoteSize: entry.remote?.size,
			remoteRev: entry.remote?.revisionId,
			lastSyncAt: nowTs,
		};
		snapshot.push(base);

		const prior = state?.entries?.[entry.path];
		const effectivePrior = prior?.tombstone ? undefined : prior;
		if (entry.type === "folder") {
			if (!entry.local && entry.remote) {
				jobs.push({
					id: `create-local-folder:${entry.path}`,
					op: "create-local-folder",
					path: entry.path,
					entryType: "folder",
					priority: 2,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "remote-folder",
				});
			} else if (entry.local && !entry.remote) {
				jobs.push({
					id: `create-remote-folder:${entry.path}`,
					op: "create-remote-folder",
					path: entry.path,
					entryType: "folder",
					priority: 8,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "local-folder",
				});
			}
			continue;
		}

		const localChanged =
			entry.local &&
			(!effectivePrior?.localMtimeMs ||
				(entry.local.mtimeMs ?? 0) >
					(effectivePrior.localMtimeMs ?? 0));
		const remoteChanged =
			entry.remote &&
			(!effectivePrior?.remoteRev ||
				(entry.remote.revisionId &&
					entry.remote.revisionId !== effectivePrior.remoteRev));

		if (entry.local && !entry.remote) {
			jobs.push({
				id: `upload:${entry.path}:${entry.local.mtimeMs ?? 0}`,
				op: "upload",
				path: entry.path,
				entryType: "file",
				priority: 5,
				attempt: 0,
				nextRunAt: nowTs,
			});
		} else if (!entry.local && entry.remote) {
			jobs.push({
				id: `download:${entry.remote.id}`,
				op: "download",
				path: entry.path,
				remoteId: entry.remote.id,
				entryType: "file",
				priority: 10,
				attempt: 0,
				nextRunAt: nowTs,
			});
		} else if (entry.local && entry.remote) {
			if (localChanged && remoteChanged) {
				jobs.push({
					id: `download:${entry.remote.id}:conflict`,
					op: "download",
					path: `${entry.path}.conflicted`,
					remoteId: entry.remote.id,
					entryType: "file",
					priority: 1,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "conflict",
				});
				jobs.push({
					id: `upload:${entry.path}:${entry.local.mtimeMs ?? 0}`,
					op: "upload",
					path: entry.path,
					entryType: "file",
					priority: 5,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "conflict-local-wins",
				});
			} else if (localChanged) {
				jobs.push({
					id: `upload:${entry.path}:${entry.local.mtimeMs ?? 0}`,
					op: "upload",
					path: entry.path,
					entryType: "file",
					priority: 5,
					attempt: 0,
					nextRunAt: nowTs,
				});
			} else if (remoteChanged) {
				jobs.push({
					id: `download:${entry.remote.id}`,
					op: "download",
					path: entry.path,
					remoteId: entry.remote.id,
					entryType: "file",
					priority: 10,
					attempt: 0,
					nextRunAt: nowTs,
				});
			}
		}
	}

	return { jobs, snapshot };
}
