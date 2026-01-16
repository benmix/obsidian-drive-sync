import type { LocalChange } from "./local-watcher";
import type { SyncEntry, SyncJob, SyncState } from "./index-types";
import { normalizePath, now } from "./utils";

export type LocalChangePlan = {
	jobs: SyncJob[];
	entries: SyncEntry[];
	removedPaths: string[];
};

export function planLocalChanges(changes: LocalChange[], state: SyncState): LocalChangePlan {
	const jobs: SyncJob[] = [];
	const entries: SyncEntry[] = [];
	const removedPaths: string[] = [];
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
					priority: 5,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "rename",
				});
				entries.push({
					relPath: toPath,
					type: "file",
					remoteId: prior.remoteId,
					lastSyncAt: nowTs,
				});
				removedPaths.push(fromPath);
			} else {
				jobs.push({
					id: `upload:${toPath}`,
					op: "upload",
					path: toPath,
					priority: 5,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "rename",
				});
				removedPaths.push(fromPath);
			}
			continue;
		}

		const path = normalizePath(change.path);

		if (change.type === "delete") {
			const prior = state.entries[path];
			if (prior?.remoteId) {
				jobs.push({
					id: `delete-remote:${path}`,
					op: "delete-remote",
					path,
					remoteId: prior.remoteId,
					priority: 15,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "delete",
				});
			}
			entries.push({
				relPath: path,
				type: "file",
				tombstone: true,
				lastSyncAt: nowTs,
			});
			continue;
		}

		const reason = change.type === "create" ? "create" : "modify";
		jobs.push({
			id: `upload:${path}`,
			op: "upload",
			path,
			priority: 5,
			attempt: 0,
			nextRunAt: nowTs,
			reason,
		});
	}

	return { jobs, entries, removedPaths };
}
