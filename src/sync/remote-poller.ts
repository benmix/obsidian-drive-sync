import {
	evaluateRemoteMissingConfirmation,
	resolveLocalOnlyDecision,
	resolveRemoteOnlyDecision,
} from "./presence-policy";
import { normalizePath, now } from "./utils";
import type { RemoteFileSystem, RemoteTreeEvent } from "./types";
import type { SyncEntry, SyncJob } from "../data/sync-schema";
import type { SyncState } from "./index-store";

type ConflictStrategy = "local-wins" | "remote-wins" | "manual";

export type RemotePollResult = {
	jobs: SyncJob[];
	snapshot: SyncEntry[];
	removedPaths: string[];
	remoteEventCursor?: string;
};

export async function pollRemoteChanges(
	remoteFs: RemoteFileSystem,
	state: SyncState,
	options?: { conflictStrategy?: ConflictStrategy },
): Promise<RemotePollResult> {
	const conflictStrategy = options?.conflictStrategy ?? "local-wins";
	const cursorPlan = await pollRemoteCursor(remoteFs, state, conflictStrategy);
	if (cursorPlan) {
		return cursorPlan;
	}

	const remoteEntries = await remoteFs.listEntries();
	const jobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const removedPaths: string[] = [];
	const nowTs = now();
	const seen = new Set<string>();
	const movedFromPaths = new Set<string>();
	const movedToPaths = new Set<string>();
	const priorByRemoteId = new Map<string, { path: string; entry: SyncEntry }>();

	for (const [path, entry] of Object.entries(state.entries)) {
		if (entry.remoteId && !entry.tombstone) {
			priorByRemoteId.set(entry.remoteId, { path, entry });
		}
	}

	for (const entry of remoteEntries) {
		const relPath = normalizePath(entry.path ?? entry.name);
		seen.add(relPath);
		const prior = state.entries[relPath] ?? priorByRemoteId.get(entry.id)?.entry;
		const priorPath = priorByRemoteId.get(entry.id)?.path;
		const remoteOnlyDecision = prior?.tombstone
			? resolveRemoteOnlyDecision({
					path: relPath,
					entryType: entry.type,
					nowTs,
					conflictStrategy,
					prior,
					remoteId: entry.id,
					remoteRev: entry.revisionId,
				})
			: undefined;
		if (remoteOnlyDecision?.job?.op === "delete-remote") {
			jobs.push(remoteOnlyDecision.job);
			continue;
		}

		if (priorPath && priorPath !== relPath) {
			movedFromPaths.add(priorPath);
			movedToPaths.add(relPath);
			jobs.push({
				id: `move-local:${priorPath}:${relPath}`,
				op: "move-local",
				path: relPath,
				fromPath: priorPath,
				toPath: relPath,
				entryType: entry.type,
				remoteId: entry.id,
				remoteRev: entry.revisionId,
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
			remoteMissingCount: undefined,
			remoteMissingSinceMs: undefined,
			lastSyncAt: nowTs,
		});
		if (remoteOnlyDecision?.job) {
			jobs.push(remoteOnlyDecision.job);
			continue;
		}

		if (entry.type === "folder") {
			if (!prior && entry.path) {
				jobs.push({
					id: `create-local-folder:${relPath}`,
					op: "create-local-folder",
					path: relPath,
					entryType: "folder",
					remoteId: entry.id,
					priority: 2,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "remote-folder",
				});
			}
			continue;
		}

		const changed =
			!prior?.remoteRev || (entry.revisionId && entry.revisionId !== prior.remoteRev);

		if (changed) {
			jobs.push({
				id: `download:${entry.id}`,
				op: "download",
				path: relPath,
				remoteId: entry.id,
				remoteRev: entry.revisionId,
				entryType: "file",
				priority: 10,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-change",
			});
		}
	}

	for (const priorPath of Object.keys(state.entries)) {
		if (seen.has(priorPath) || movedFromPaths.has(priorPath) || movedToPaths.has(priorPath)) {
			continue;
		}
		const prior = state.entries[priorPath];
		if (!prior || prior.tombstone) {
			continue;
		}
		if (prior.remoteId) {
			const missing = evaluateRemoteMissingConfirmation(prior, nowTs);
			if (!missing.confirmed) {
				snapshot.push(buildRemoteMissingTrackingEntry(priorPath, prior, missing, nowTs));
				continue;
			}
			const decision = resolveLocalOnlyDecision({
				path: priorPath,
				entryType: prior.type,
				nowTs,
				conflictStrategy,
				prior,
			});
			if (decision.job) {
				jobs.push(decision.job);
			}
			if (decision.removePriorPath) {
				removedPaths.push(priorPath);
			}
		}
	}

	return { jobs, snapshot, removedPaths };
}

async function pollRemoteCursor(
	remoteFs: RemoteFileSystem,
	state: SyncState,
	conflictStrategy: ConflictStrategy,
): Promise<RemotePollResult | null> {
	if (!remoteFs.getRootFolder || !remoteFs.subscribeToTreeEvents) {
		return null;
	}

	if (!state.remoteEventCursor) {
		return null;
	}

	const root = await remoteFs.getRootFolder();
	const scope = root?.treeEventScopeId;
	if (!scope) {
		return null;
	}

	const events: RemoteTreeEvent[] = [];
	const subscription = await remoteFs.subscribeToTreeEvents(scope, async (event) => {
		events.push(event);
	});

	await new Promise((resolve) => window.setTimeout(resolve, 750));
	subscription.dispose();

	if (events.length === 0) {
		return null;
	}

	let requiresFullRefresh = false;
	const remoteJobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const removedPaths: string[] = [];
	let latestEventId: string | undefined = state.remoteEventCursor;

	const remoteIds = new Set<string>();
	for (const entry of Object.values(state.entries ?? {})) {
		if (entry.remoteId) {
			remoteIds.add(entry.remoteId);
		}
	}
	for (const event of events) {
		if (event.eventId) {
			latestEventId = event.eventId;
		}
		if (event.type === "tree_refresh" || event.type === "tree_remove") {
			requiresFullRefresh = true;
			continue;
		}
		if (
			event.type === "node_created" ||
			event.type === "node_updated" ||
			event.type === "node_deleted"
		) {
			if (event.nodeUid) {
				remoteIds.add(event.nodeUid);
			}
		}
	}

	if (requiresFullRefresh || remoteIds.size === 0) {
		return null;
	}

	const nowTs = now();
	for (const id of remoteIds) {
		const node = await remoteFs.getNode?.(id);
		if (!node) {
			const priorPath = Object.keys(state.entries).find(
				(key) => state.entries[key]?.remoteId === id,
			);
			if (priorPath) {
				const prior = state.entries[priorPath];
				if (prior) {
					const missing = evaluateRemoteMissingConfirmation(prior, nowTs);
					if (!missing.confirmed) {
						snapshot.push(
							buildRemoteMissingTrackingEntry(priorPath, prior, missing, nowTs),
						);
						continue;
					}
					const decision = resolveLocalOnlyDecision({
						path: priorPath,
						entryType: prior.type,
						nowTs,
						conflictStrategy,
						prior,
					});
					if (decision.job) {
						remoteJobs.push(decision.job);
					}
					if (decision.removePriorPath) {
						removedPaths.push(priorPath);
					}
				}
			}
			continue;
		}
		const relPath = normalizePath(node.path ?? node.name);
		const prior = state.entries[relPath];
		const changed =
			!prior?.remoteRev || (node.revisionId && node.revisionId !== prior.remoteRev);
		const nextEntry: SyncEntry = {
			relPath,
			type: node.type,
			remoteId: node.id,
			remoteParentId: node.parentId,
			remoteMtimeMs: node.mtimeMs,
			remoteSize: node.size,
			remoteRev: node.revisionId,
			remoteMissingCount: undefined,
			remoteMissingSinceMs: undefined,
			lastSyncAt: nowTs,
		};
		if (prior?.conflict) {
			nextEntry.conflict = prior.conflict;
		}
		snapshot.push(nextEntry);
		if (node.type === "folder") {
			if (!prior) {
				remoteJobs.push({
					id: `create-local-folder:${relPath}`,
					op: "create-local-folder",
					path: relPath,
					entryType: "folder",
					remoteId: node.id,
					priority: 2,
					attempt: 0,
					nextRunAt: nowTs,
					reason: "remote-folder",
				});
			}
			continue;
		}
		if (changed) {
			remoteJobs.push({
				id: `download:${node.id}`,
				op: "download",
				path: relPath,
				remoteId: node.id,
				remoteRev: node.revisionId,
				entryType: "file",
				priority: 10,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-change",
			});
		}
	}

	return {
		jobs: remoteJobs,
		snapshot,
		removedPaths,
		remoteEventCursor: latestEventId,
	};
}

function buildRemoteMissingTrackingEntry(
	path: string,
	prior: SyncEntry,
	missing: { nextCount: number; sinceMs: number },
	nowTs: number,
): SyncEntry {
	return {
		...prior,
		relPath: path,
		lastSyncAt: nowTs,
		remoteMissingCount: missing.nextCount,
		remoteMissingSinceMs: missing.sinceMs,
	};
}
