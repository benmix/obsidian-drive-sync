import type { RemoteFileSystem } from "./types";
import type { SyncEntry, SyncJob, SyncState } from "./index-types";
import { normalizePath, now } from "./utils";

export type RemotePollResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
	removedPaths: string[];
};

export async function pollRemoteChanges(
	remoteFs: RemoteFileSystem,
	state: SyncState,
): Promise<RemotePollResult> {
	const remoteEntries = await remoteFs.listEntries();
	const jobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const removedPaths: string[] = [];
	const nowTs = now();
	const seen = new Set<string>();
	const movedFromPaths = new Set<string>();
	const priorByRemoteId = new Map<
		string,
		{ path: string; entry: SyncEntry }
	>();

	for (const [path, entry] of Object.entries(state.entries)) {
		if (entry.remoteId && !entry.tombstone) {
			priorByRemoteId.set(entry.remoteId, { path, entry });
		}
	}

	for (const entry of remoteEntries) {
		const relPath = normalizePath(entry.path ?? entry.name);
		seen.add(relPath);
		const prior =
			state.entries[relPath] ?? priorByRemoteId.get(entry.id)?.entry;
		const priorPath = priorByRemoteId.get(entry.id)?.path;

		if (priorPath && priorPath !== relPath) {
			movedFromPaths.add(priorPath);
			jobs.push({
				id: `move-local:${priorPath}:${relPath}`,
				op: "move-local",
				path: relPath,
				fromPath: priorPath,
				toPath: relPath,
				entryType: entry.type,
				priority: 5,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-rename",
			});
			removedPaths.push(priorPath);
		}

		snapshot.push({
			relPath,
			type: entry.type,
			remoteId: entry.id,
			remoteParentId: entry.parentId,
			remoteMtimeMs: entry.mtimeMs,
			remoteSize: entry.size,
			remoteRev: entry.revisionId,
			lastSyncAt: nowTs,
		});

		if (entry.type === "folder") {
			if (!prior && entry.path) {
				jobs.push({
					id: `create-local-folder:${relPath}`,
					op: "create-local-folder",
					path: relPath,
					entryType: "folder",
					priority: 2,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "remote-folder",
				});
			}
			continue;
		}

		const changed =
			!prior?.remoteRev ||
			(entry.revisionId && entry.revisionId !== prior.remoteRev);

		if (changed) {
			jobs.push({
				id: `download:${entry.id}`,
				op: "download",
				path: relPath,
				remoteId: entry.id,
				entryType: "file",
				priority: 10,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-change",
			});
		}
	}

	for (const priorPath of Object.keys(state.entries)) {
		if (seen.has(priorPath) || movedFromPaths.has(priorPath)) {
			continue;
		}
		const prior = state.entries[priorPath];
		if (!prior || prior.tombstone) {
			continue;
		}
		if (prior.type === "folder") {
			jobs.push({
				id: `delete-local:${priorPath}`,
				op: "delete-local",
				path: priorPath,
				entryType: "folder",
				priority: 25,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-folder-delete",
			});
			continue;
		}
		if (prior.remoteId) {
			jobs.push({
				id: `delete-local:${priorPath}`,
				op: "delete-local",
				path: priorPath,
				entryType: prior.type,
				priority: 20,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-delete",
			});
		}
	}

	return { jobs, snapshot, removedPaths };
}
