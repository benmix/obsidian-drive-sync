import { dirname, normalizePath, now } from "./utils";
import type { SyncEntry, SyncJob } from "../data/sync-schema";
import type { LocalChange } from "./local-watcher";
import type { SyncState } from "./index-store";

export type LocalChangePlan = {
	jobs: SyncJob[];
	entries: SyncEntry[];
	removedPaths: string[];
	rewritePrefixes: Array<{ from: string; to: string }>;
};

export function planLocalChanges(changes: LocalChange[], state: SyncState): LocalChangePlan {
	const jobs: SyncJob[] = [];
	const entries: SyncEntry[] = [];
	const removedPaths: string[] = [];
	const rewritePrefixes: Array<{ from: string; to: string }> = [];
	const nowTs = now();

	for (const change of changes) {
		if (change.type === "rename") {
			const fromPath = normalizePath(change.from);
			const toPath = normalizePath(change.to);
			const prior = state.entries[fromPath];

			if (prior?.remoteId) {
				jobs.push({
					id: `move-remote:${prior.remoteId}:${toPath}`,
					op: "move-remote",
					path: fromPath,
					fromPath,
					toPath,
					remoteId: prior.remoteId,
					entryType: prior.type,
					priority: 5,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "rename",
				});
				entries.push({
					relPath: toPath,
					type: prior.type,
					remoteId: prior.remoteId,
					remoteParentId: prior.remoteParentId,
					lastSyncAt: nowTs,
				});
				removedPaths.push(fromPath);
				if (prior.type === "folder") {
					rewritePrefixes.push({ from: fromPath, to: toPath });
				}
			} else {
				if (change.entryType === "folder") {
					jobs.push({
						id: `create-remote-folder:${toPath}`,
						op: "create-remote-folder",
						path: toPath,
						entryType: "folder",
						priority: 6,
						attempt: 0,
						nextRunAt: nowTs,
						reason: "rename-folder",
					});
				} else {
					jobs.push({
						id: `upload:${toPath}`,
						op: "upload",
						path: toPath,
						entryType: "file",
						priority: 5,
						attempt: 0,
						nextRunAt: nowTs,
						reason: "rename",
					});
				}
				removedPaths.push(fromPath);
				if (change.entryType === "folder") {
					rewritePrefixes.push({ from: fromPath, to: toPath });
				}
			}
			continue;
		}

		const path = normalizePath(change.path);
		const parentPath = dirname(path);
		if (parentPath) {
			entries.push({
				relPath: parentPath,
				type: "folder",
				lastSyncAt: nowTs,
			});
		}

		if (change.type === "delete") {
			const prior = state.entries[path];
			if (prior?.remoteId) {
				jobs.push({
					id: `delete-remote:${path}`,
					op: "delete-remote",
					path,
					remoteId: prior.remoteId,
					entryType: prior.type,
					priority: 15,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "delete",
				});
			}
			entries.push({
				relPath: path,
				type: prior?.type ?? change.entryType ?? "file",
				tombstone: true,
				lastSyncAt: nowTs,
			});
			continue;
		}

		const reason = change.type === "create" ? "create" : "modify";
		if (!state.entries[parentPath] && parentPath) {
			jobs.push({
				id: `create-remote-folder:${parentPath}`,
				op: "create-remote-folder",
				path: parentPath,
				entryType: "folder",
				priority: 6,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "ensure-parent",
			});
		}
		if (change.entryType === "folder") {
			jobs.push({
				id: `create-remote-folder:${path}`,
				op: "create-remote-folder",
				path,
				entryType: "folder",
				priority: 6,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "create-folder",
			});
		} else {
			jobs.push({
				id: `upload:${path}`,
				op: "upload",
				path,
				entryType: "file",
				priority: 5,
				attempt: 0,
				nextRunAt: nowTs,
				reason,
			});
		}
	}

	return { jobs, entries, removedPaths, rewritePrefixes };
}
