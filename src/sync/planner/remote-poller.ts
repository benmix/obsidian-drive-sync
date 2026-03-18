import type { SyncEntry, SyncJob } from "../../contracts/data/sync-schema";
import type {
	RemoteEntryChangeEvent,
	RemoteFileSystem,
} from "../../contracts/filesystem/file-system";
import type { RemotePollResult } from "../../contracts/sync/remote-poller";
import type { SyncState } from "../../contracts/sync/state";
import { DEFAULT_SYNC_STRATEGY, type SyncStrategy } from "../../contracts/sync/strategy";
import { normalizePath } from "../../filesystem/path";
import { now } from "../support/utils";

import {
	evaluateRemoteMissingConfirmation,
	resolveBothPresentDecision,
	resolveLocalOnlyDecision,
	resolveRemoteOnlyDecision,
} from "./presence-policy";

export async function pollRemoteChanges(
	remoteFileSystem: RemoteFileSystem,
	state: SyncState,
	options?: { syncStrategy?: SyncStrategy; preferRemoteSeed?: boolean },
): Promise<RemotePollResult> {
	const syncStrategy = options?.syncStrategy ?? DEFAULT_SYNC_STRATEGY;
	const cursorPlan = await pollRemoteCursor(
		remoteFileSystem,
		state,
		syncStrategy,
		Boolean(options?.preferRemoteSeed),
	);
	if (cursorPlan) {
		return cursorPlan;
	}

	const remoteEntries = await remoteFileSystem.listEntries();
	const preferRemoteSeed = Boolean(options?.preferRemoteSeed) && remoteEntries.length > 0;
	const jobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const removedPaths: string[] = [];
	const nowTs = now();
	const seen = new Set<string>();
	const movedFromPaths = new Set<string>();
	const movedToPaths = new Set<string>();
	const priorByRemoteId = buildPriorByRemoteId(state);

	for (const entry of remoteEntries) {
		const relPath = normalizePath(entry.path ?? entry.name);
		seen.add(relPath);
		const priorInfo = priorByRemoteId.get(entry.id);
		const priorPath = priorInfo?.path;
		const prior = state.entries[relPath] ?? priorInfo?.entry;
		const applyRemoteOnlyDecision = !prior || prior.tombstone === true;
		const remoteOnlyDecision = applyRemoteOnlyDecision
			? resolveRemoteOnlyDecision({
					path: relPath,
					entryType: entry.type,
					nowTs,
					syncStrategy,
					prior,
					remoteId: entry.id,
					remoteRev: entry.revisionId,
					preferRemoteSeed,
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

		const nextEntry: SyncEntry = {
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
		};
		if (prior?.conflict) {
			nextEntry.conflict = prior.conflict;
		}
		if (prior?.conflictPending) {
			nextEntry.conflictPending = true;
		}
		snapshot.push(nextEntry);

		if (remoteOnlyDecision?.job) {
			jobs.push(remoteOnlyDecision.job);
			continue;
		}

		if (entry.type === "folder") {
			continue;
		}

		const changed =
			!prior?.remoteRev || (entry.revisionId && entry.revisionId !== prior.remoteRev);

		if (!changed) {
			continue;
		}

		const decision = resolveBothPresentDecision({
			path: relPath,
			nowTs,
			syncStrategy,
			remoteId: entry.id,
			remoteRev: entry.revisionId,
			localChanged: false,
			remoteChanged: true,
			prior,
		});
		if (decision.conflict) {
			nextEntry.conflict = decision.conflict;
		}
		if (decision.conflictPending !== undefined) {
			nextEntry.conflictPending = decision.conflictPending;
		}
		jobs.push(...decision.jobs);
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
				syncStrategy,
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
	remoteFileSystem: RemoteFileSystem,
	state: SyncState,
	syncStrategy: SyncStrategy,
	preferRemoteSeed: boolean,
): Promise<RemotePollResult | null> {
	if (!remoteFileSystem.getRootEntry || !remoteFileSystem.subscribeToEntryChanges) {
		return null;
	}

	const root = await remoteFileSystem.getRootEntry();
	const scope = root?.eventScopeId;
	if (!scope) {
		return null;
	}

	if (!state.remoteEventCursor) {
		remoteFileSystem.setLatestEventCursor?.(scope, undefined);
	} else {
		remoteFileSystem.setLatestEventCursor?.(scope, state.remoteEventCursor);
	}

	const events: RemoteEntryChangeEvent[] = [];
	const subscription = await remoteFileSystem.subscribeToEntryChanges(scope, async (event) => {
		events.push(event);
	});

	await new Promise((resolve) => setTimeout(resolve, 750));
	subscription.dispose();

	if (events.length === 0) {
		return null;
	}

	let requiresFullRefresh = false;
	const remoteJobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const removedPaths: string[] = [];
	let latestEventId: string | undefined = state.remoteEventCursor;
	const priorByRemoteId = buildPriorByRemoteId(state);

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
			if (event.entryId) {
				remoteIds.add(event.entryId);
			}
		}
	}

	if (requiresFullRefresh || remoteIds.size === 0) {
		remoteFileSystem.setLatestEventCursor?.(scope, latestEventId);
		return null;
	}

	const nowTs = now();
	for (const id of remoteIds) {
		const node = await remoteFileSystem.getEntry?.(id);
		if (!node) {
			const priorInfo = priorByRemoteId.get(id);
			const priorPath = priorInfo?.path;
			const prior = priorInfo?.entry;
			if (priorPath && prior) {
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
					syncStrategy,
					prior,
				});
				if (decision.job) {
					remoteJobs.push(decision.job);
				}
				if (decision.removePriorPath) {
					removedPaths.push(priorPath);
				}
			}
			continue;
		}
		const relPath = normalizePath(node.path ?? node.name);
		const priorInfo = priorByRemoteId.get(node.id);
		const priorPath = priorInfo?.path;
		const prior = state.entries[relPath] ?? priorInfo?.entry;
		const applyRemoteOnlyDecision = !prior || prior.tombstone === true;
		const remoteOnlyDecision = applyRemoteOnlyDecision
			? resolveRemoteOnlyDecision({
					path: relPath,
					entryType: node.type,
					nowTs,
					syncStrategy,
					prior,
					remoteId: node.id,
					remoteRev: node.revisionId,
					preferRemoteSeed,
				})
			: undefined;

		if (remoteOnlyDecision?.job?.op === "delete-remote") {
			remoteJobs.push(remoteOnlyDecision.job);
			continue;
		}
		if (priorPath && priorPath !== relPath) {
			remoteJobs.push({
				id: `move-local:${priorPath}:${relPath}`,
				op: "move-local",
				path: relPath,
				fromPath: priorPath,
				toPath: relPath,
				entryType: node.type,
				remoteId: node.id,
				remoteRev: node.revisionId,
				priority: 5,
				attempt: 0,
				nextRunAt: nowTs,
				reason: "remote-rename",
			});
			removedPaths.push(priorPath);
		}

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
		if (prior?.conflictPending) {
			nextEntry.conflictPending = true;
		}
		snapshot.push(nextEntry);

		if (remoteOnlyDecision?.job) {
			remoteJobs.push(remoteOnlyDecision.job);
			continue;
		}

		if (node.type === "folder") {
			continue;
		}

		const changed =
			!prior?.remoteRev || (node.revisionId && node.revisionId !== prior.remoteRev);
		if (!changed) {
			continue;
		}

		const decision = resolveBothPresentDecision({
			path: relPath,
			nowTs,
			syncStrategy,
			remoteId: node.id,
			remoteRev: node.revisionId,
			localChanged: false,
			remoteChanged: true,
			prior,
		});
		if (decision.conflict) {
			nextEntry.conflict = decision.conflict;
		}
		if (decision.conflictPending !== undefined) {
			nextEntry.conflictPending = decision.conflictPending;
		}
		remoteJobs.push(...decision.jobs);
	}

	return {
		jobs: remoteJobs,
		snapshot,
		removedPaths,
		remoteEventCursor: latestEventId,
	};
}

function buildPriorByRemoteId(state: SyncState): Map<string, { path: string; entry: SyncEntry }> {
	const priorByRemoteId = new Map<string, { path: string; entry: SyncEntry }>();
	for (const [path, entry] of Object.entries(state.entries)) {
		if (entry.remoteId && !entry.tombstone) {
			priorByRemoteId.set(entry.remoteId, { path, entry });
		}
	}
	return priorByRemoteId;
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
