import type { SyncEntry, SyncJob } from "../../contracts/data/sync-schema";
import type { LocalFileSystem, RemoteFileSystem } from "../../contracts/filesystem/file-system";
import type { ReconcileResult } from "../../contracts/sync/reconcile";
import type { SyncState } from "../../contracts/sync/state";
import { DEFAULT_SYNC_STRATEGY, type SyncStrategy } from "../../contracts/sync/strategy";
import { normalizePath } from "../../filesystem/path";
import { now } from "../support/utils";

import { isInitializationPhase, shouldPreferRemoteSeed } from "./initialization";
import { compareMtimeWithTolerance } from "./mtime";
import {
	evaluateRemoteMissingConfirmation,
	resolveBothPresentDecision,
	resolveLocalOnlyDecision,
	resolveRemoteOnlyDecision,
	resolveTrackedMissingDecision,
} from "./presence-policy";

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
	localFileSystem: LocalFileSystem,
	remoteFileSystem: RemoteFileSystem,
	state?: SyncState,
	options?: { syncStrategy?: SyncStrategy; preferRemoteSeed?: boolean },
): Promise<ReconcileResult> {
	const localEntries = await localFileSystem.listEntries();
	const remoteEntries = await remoteFileSystem.listEntries();
	const jobs: SyncJob[] = [];
	const snapshot: SyncEntry[] = [];
	const nowTs = now();
	const syncStrategy = options?.syncStrategy ?? DEFAULT_SYNC_STRATEGY;
	const initializationPhase = isInitializationPhase(state);
	const preferRemoteSeed =
		options?.preferRemoteSeed ??
		shouldPreferRemoteSeed(state, localEntries.length, remoteEntries.length);
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
			remoteMissingCount: undefined,
			remoteMissingSinceMs: undefined,
			lastSyncAt: nowTs,
		};
		if (prior?.conflict) {
			base.conflict = prior.conflict;
		}
		if (prior?.conflictPending) {
			base.conflictPending = true;
		}
		snapshot.push(base);

		const effectivePrior = prior?.tombstone ? undefined : prior;
		void effectivePrior;
		if (entry.type === "folder") {
			if (entry.local && !entry.remote) {
				if (prior?.remoteId) {
					const missing = evaluateRemoteMissingConfirmation(prior, nowTs);
					if (!missing.confirmed) {
						keepUnconfirmedRemoteMissing(base, prior, missing);
						continue;
					}
				}
				const decision = resolveLocalOnlyDecision({
					path: entry.path,
					entryType: "folder",
					nowTs,
					syncStrategy,
					prior,
					preferRemoteSeed,
				});
				if (decision.job) {
					jobs.push(decision.job);
				}
			} else if (!entry.local && entry.remote) {
				const decision = resolveRemoteOnlyDecision({
					path: entry.path,
					entryType: "folder",
					nowTs,
					syncStrategy,
					prior,
					remoteId: entry.remote.id,
					remoteRev: entry.remote.revisionId,
					preferRemoteSeed,
				});
				if (decision.job) {
					if (decision.job.op === "delete-remote") {
						base.tombstone = true;
					}
					jobs.push(decision.job);
				}
			}
			continue;
		}

		if (shouldSeedInitializationBaseline(entry, initializationPhase, prior)) {
			base.syncedRemoteRev = entry.remote?.revisionId;
			continue;
		}
		if (
			await shouldSeedInitializationBaselineByContent(
				entry,
				initializationPhase,
				prior,
				localFileSystem,
				remoteFileSystem,
			)
		) {
			base.syncedRemoteRev = entry.remote?.revisionId;
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
				Boolean(
					entry.remote.revisionId &&
					entry.remote.revisionId !==
						(effectivePrior?.syncedRemoteRev ?? effectivePrior?.remoteRev),
				)
			: false;

		if (entry.local && !entry.remote) {
			if (prior?.remoteId) {
				const missing = evaluateRemoteMissingConfirmation(prior, nowTs);
				if (!missing.confirmed) {
					keepUnconfirmedRemoteMissing(base, prior, missing);
					continue;
				}
			}
			const decision = resolveLocalOnlyDecision({
				path: entry.path,
				entryType: "file",
				nowTs,
				syncStrategy,
				prior,
				preferRemoteSeed,
			});
			if (decision.job) {
				jobs.push(decision.job);
			}
		} else if (!entry.local && entry.remote) {
			const decision = resolveRemoteOnlyDecision({
				path: entry.path,
				entryType: "file",
				nowTs,
				syncStrategy,
				prior,
				remoteId: entry.remote.id,
				remoteRev: entry.remote.revisionId,
				preferRemoteSeed,
			});
			if (decision.job) {
				if (decision.job.op === "delete-remote") {
					base.tombstone = true;
				}
				jobs.push(decision.job);
			}
		} else if (entry.local && entry.remote) {
			const decision = resolveBothPresentDecision({
				path: entry.path,
				nowTs,
				syncStrategy,
				remoteId: entry.remote.id,
				remoteRev: entry.remote.revisionId,
				remoteMtimeMs: entry.remote.mtimeMs,
				localMtimeMs: entry.local?.mtimeMs,
				localChanged,
				remoteChanged,
				prior,
				initializationPhase,
			});
			if (decision.conflict) {
				base.conflict = decision.conflict;
			}
			if (decision.conflictPending !== undefined) {
				base.conflictPending = decision.conflictPending;
			}
			jobs.push(...decision.jobs);
		}
	}

	for (const [path, prior] of Object.entries(state?.entries ?? {})) {
		if (seen.has(path) || prior.tombstone) {
			continue;
		}
		const decision = resolveTrackedMissingDecision({
			path,
			nowTs,
			prior,
		});
		if (decision.job) {
			jobs.push(decision.job);
		}
	}

	return { jobs, snapshot };
}

function keepUnconfirmedRemoteMissing(
	base: SyncEntry,
	prior: SyncEntry,
	missing: { nextCount: number; sinceMs: number },
): void {
	base.remoteId = prior.remoteId;
	base.remoteParentId = prior.remoteParentId;
	base.remoteMtimeMs = prior.remoteMtimeMs;
	base.remoteSize = prior.remoteSize;
	base.remoteRev = prior.remoteRev;
	base.remoteMissingCount = missing.nextCount;
	base.remoteMissingSinceMs = missing.sinceMs;
}

function shouldSeedInitializationBaseline(
	entry: EntrySnapshot,
	initializationPhase: boolean,
	prior?: SyncEntry,
): boolean {
	if (
		!initializationPhase ||
		entry.type !== "file" ||
		!entry.local ||
		!entry.remote ||
		prior?.conflictPending ||
		prior?.conflict ||
		typeof entry.remote.revisionId !== "string"
	) {
		return false;
	}

	return (
		compareMtimeWithTolerance(entry.local.mtimeMs, entry.remote.mtimeMs) === 0 &&
		typeof entry.local.size === "number" &&
		typeof entry.remote.size === "number" &&
		entry.local.size === entry.remote.size
	);
}

async function shouldSeedInitializationBaselineByContent(
	entry: EntrySnapshot,
	initializationPhase: boolean,
	prior: SyncEntry | undefined,
	localFileSystem: LocalFileSystem,
	remoteFileSystem: RemoteFileSystem,
): Promise<boolean> {
	if (
		!initializationPhase ||
		entry.type !== "file" ||
		!entry.local ||
		!entry.remote ||
		prior?.conflictPending ||
		prior?.conflict ||
		typeof entry.remote.id !== "string" ||
		typeof entry.remote.revisionId !== "string"
	) {
		return false;
	}

	if (
		typeof entry.local.size === "number" &&
		typeof entry.remote.size === "number" &&
		entry.local.size !== entry.remote.size
	) {
		return false;
	}

	const [localBytes, remoteBytes] = await Promise.all([
		localFileSystem.readFile(entry.path),
		remoteFileSystem.readFile(entry.remote.id),
	]);

	return sameBytes(localBytes, remoteBytes);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.byteLength !== right.byteLength) {
		return false;
	}
	for (let index = 0; index < left.byteLength; index += 1) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}
