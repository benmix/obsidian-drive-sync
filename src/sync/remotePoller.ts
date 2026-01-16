import type {RemoteFileSystem} from "./types";
import type {SyncEntry, SyncJob, SyncState} from "./indexTypes";
import {normalizePath, now} from "./utils";

export type RemotePollResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
};

export async function pollRemoteChanges(
	remoteFs: RemoteFileSystem,
	state: SyncState
): Promise<RemotePollResult> {
	const remoteFiles = await remoteFs.listFiles();
	const jobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const nowTs = now();
	const seen = new Set<string>();

	for (const file of remoteFiles) {
		const relPath = normalizePath(file.name);
		seen.add(relPath);
		const prior = state.entries[relPath];
		const changed = !prior?.remoteRev || (file.revisionId && file.revisionId !== prior.remoteRev);

		snapshot.push({
			relPath,
			type: "file",
			remoteId: file.id,
			remoteMtimeMs: file.mtimeMs,
			remoteSize: file.size,
			remoteRev: file.revisionId,
			lastSyncAt: nowTs
		});

		if (changed) {
			jobs.push({
				id: `download:${file.id}`,
				op: "download",
				path: relPath,
				remoteId: file.id,
				priority: 10,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-change"
			});
		}
	}

	for (const priorPath of Object.keys(state.entries)) {
		if (seen.has(priorPath)) {
			continue;
		}
		const prior = state.entries[priorPath];
		if (prior?.remoteId) {
			jobs.push({
				id: `delete-local:${priorPath}`,
				op: "delete-local",
				path: priorPath,
				priority: 20,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-delete"
			});
		}
	}

	return {jobs, snapshot};
}
