import type { SyncEntry, SyncJob } from "../data/sync-schema";
import type { SyncState } from "./index-store";
import type { LocalFileSystem, RemoteFileSystem } from "./types";
import { buildConflictName, normalizePath, now } from "./utils";

type ConflictStrategy = "local-wins" | "remote-wins" | "manual";

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
	options?: { conflictStrategy?: ConflictStrategy },
): Promise<ReconcileResult> {
	const localEntries = await localFs.listEntries();
	const remoteEntries = await remoteFs.listEntries();
	const jobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const nowTs = now();
	const conflictStrategy = options?.conflictStrategy ?? "local-wins";
	const seen = new Set<string>();

	const byPath: Record<string, EntrySnapshot> = {};

	for (const entry of localEntries) {
		const relPath = normalizePath(entry.path);
		seen.add(relPath);
		byPath[relPath] = {
			...(byPath[relPath] ?? { path: relPath }),
			type: entry.type,
			local: { mtimeMs: entry.mtimeMs, size: entry.size },
		};
	}

	for (const entry of remoteEntries) {
		const relPath = normalizePath(entry.path ?? entry.name);
		seen.add(relPath);
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
		const prior = state?.entries?.[entry.path];
		const base: SyncEntry = {
			relPath: entry.path,
			type: entry.type,
			localMtimeMs: entry.type === "file" ? entry.local?.mtimeMs : undefined,
			localSize: entry.type === "file" ? entry.local?.size : undefined,
			remoteId: entry.remote?.id,
			remoteParentId: entry.remote?.parentId,
			remoteMtimeMs: entry.remote?.mtimeMs,
			remoteSize: entry.remote?.size,
			remoteRev: entry.remote?.revisionId,
			lastSyncAt: nowTs,
		};
		if (prior?.conflict) {
			base.conflict = prior.conflict;
		}
		snapshot.push(base);

		const effectivePrior = prior?.tombstone ? undefined : prior;
		void effectivePrior;
		if (entry.type === "folder") {
			if (!entry.local && entry.remote) {
				jobs.push({
					id: `create-local-folder:${entry.path}`,
					op: "create-local-folder",
					path: entry.path,
					entryType: "folder",
					remoteId: entry.remote?.id,
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
					remoteId: undefined,
					priority: 8,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "local-folder",
				});
			}
			continue;
		}

		const localChanged = entry.local
			? !effectivePrior?.syncedLocalHash &&
				!effectivePrior?.localMtimeMs &&
				!effectivePrior?.localSize
				? true
				: (entry.local.mtimeMs ?? 0) > (effectivePrior?.localMtimeMs ?? 0) ||
					(entry.local.size ?? 0) !== (effectivePrior?.localSize ?? 0)
			: false;
		const remoteChanged = entry.remote
			? !effectivePrior?.syncedRemoteRev ||
				(entry.remote.revisionId &&
					entry.remote.revisionId !==
						(effectivePrior?.syncedRemoteRev ?? effectivePrior?.remoteRev))
			: false;

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
				remoteRev: entry.remote.revisionId,
				entryType: "file",
				priority: 10,
				attempt: 0,
				nextRunAt: nowTs,
			});
		} else if (entry.local && entry.remote) {
			if (localChanged && remoteChanged) {
				if (conflictStrategy === "manual") {
					base.conflict = {
						localMtimeMs: entry.local?.mtimeMs,
						remoteRev: entry.remote?.revisionId,
						remoteId: entry.remote?.id,
						detectedAt: nowTs,
					};
					jobs.push({
						id: `conflict:${entry.path}:${nowTs}`,
						op: "download",
						path: entry.path,
						entryType: "file",
						priority: 1,
						attempt: 0,
						nextRunAt: nowTs + 1000 * 60 * 60 * 24 * 365,
						reason: "conflict-manual",
					});
				} else if (conflictStrategy === "remote-wins") {
					jobs.push({
						id: `download:${entry.remote.id}`,
						op: "download",
						path: entry.path,
						remoteId: entry.remote.id,
						remoteRev: entry.remote.revisionId,
						entryType: "file",
						priority: 5,
						attempt: 0,
						nextRunAt: nowTs,
						reason: "conflict-remote-wins",
					});
				} else {
					const conflictPath = buildConflictName(entry.path, nowTs);
					jobs.push({
						id: `download:${entry.remote.id}:conflict`,
						op: "download",
						path: conflictPath,
						remoteId: entry.remote.id,
						remoteRev: entry.remote.revisionId,
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
				}
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
					remoteRev: entry.remote.revisionId,
					entryType: "file",
					priority: 10,
					attempt: 0,
					nextRunAt: nowTs,
				});
			}
		}
	}

	for (const [path, prior] of Object.entries(state?.entries ?? {})) {
		if (seen.has(path) || prior.tombstone) {
			continue;
		}
		if (prior.remoteId) {
			jobs.push({
				id: `delete-remote:${path}`,
				op: "delete-remote",
				path,
				remoteId: prior.remoteId,
				entryType: prior.type,
				priority: 20,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "local-missing",
			});
		} else {
			jobs.push({
				id: `delete-local:${path}`,
				op: "delete-local",
				path,
				entryType: prior.type,
				priority: 20,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-missing",
			});
		}
	}

	return { jobs, snapshot };
}
