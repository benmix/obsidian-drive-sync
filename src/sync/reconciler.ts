import type { LocalFileSystem, RemoteFileSystem } from "./types";
import type { SyncEntry, SyncJob, SyncState } from "./index-types";
import { normalizePath, now } from "./utils";

export type ReconcileResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
};

type FileSnapshot = {
	path: string;
	local?: {
		mtimeMs: number;
		size: number;
	};
	remote?: {
		id: string;
		mtimeMs?: number;
		size?: number;
		revisionId?: string;
	};
};

export async function reconcileSnapshot(
	localFs: LocalFileSystem,
	remoteFs: RemoteFileSystem,
	state?: SyncState,
): Promise<ReconcileResult> {
	const localFiles = await localFs.listFiles();
	const remoteFiles = await remoteFs.listFiles();
	const jobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const nowTs = now();

	const byPath: Record<string, FileSnapshot> = {};

	for (const file of localFiles) {
		const relPath = normalizePath(file.path);
		byPath[relPath] = {
			...(byPath[relPath] ?? { path: relPath }),
			local: { mtimeMs: file.mtimeMs, size: file.size },
		};
	}

	for (const file of remoteFiles) {
		const relPath = normalizePath(file.name);
		byPath[relPath] = {
			...(byPath[relPath] ?? { path: relPath }),
			remote: {
				id: file.id,
				mtimeMs: file.mtimeMs,
				size: file.size,
				revisionId: file.revisionId,
			},
		};
	}

	for (const entry of Object.values(byPath)) {
		const base: SyncEntry = {
			relPath: entry.path,
			type: "file",
			localMtimeMs: entry.local?.mtimeMs,
			localSize: entry.local?.size,
			remoteId: entry.remote?.id,
			remoteMtimeMs: entry.remote?.mtimeMs,
			remoteSize: entry.remote?.size,
			remoteRev: entry.remote?.revisionId,
			lastSyncAt: nowTs,
		};
		snapshot.push(base);

		const prior = state?.entries?.[entry.path];
		const localChanged =
			entry.local && (!prior?.localMtimeMs || entry.local.mtimeMs > prior.localMtimeMs);
		const remoteChanged =
			entry.remote &&
			(!prior?.remoteRev ||
				(entry.remote.revisionId && entry.remote.revisionId !== prior.remoteRev));

		if (entry.local && !entry.remote) {
			jobs.push({
				id: `upload:${entry.path}:${entry.local.mtimeMs}`,
				op: "upload",
				path: entry.path,
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
					priority: 1,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "conflict",
				});
				jobs.push({
					id: `upload:${entry.path}:${entry.local.mtimeMs}`,
					op: "upload",
					path: entry.path,
					priority: 5,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "conflict-local-wins",
				});
			} else if (localChanged) {
				jobs.push({
					id: `upload:${entry.path}:${entry.local.mtimeMs}`,
					op: "upload",
					path: entry.path,
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
					priority: 10,
					attempt: 0,
					nextRunAt: nowTs,
				});
			}
		}
	}

	return { jobs, snapshot };
}
