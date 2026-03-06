import {
	evaluateRemoteMissingConfirmation,
	resolveBothPresentDecision,
	resolveLocalOnlyDecision,
	resolveRemoteOnlyDecision,
	resolveTrackedMissingDecision,
} from "./presence-policy";
import type { LocalFileSystem, RemoteFileSystem } from "../../filesystem/contracts";
import type { SyncEntry, SyncJob } from "../../data/sync-schema";
import { normalizePath } from "../../filesystem/path";
import { now } from "../support/utils";
import type { SyncState } from "../state/index-store";

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
	localFileSystem: LocalFileSystem,
	remoteFileSystem: RemoteFileSystem,
	state?: SyncState,
	options?: { conflictStrategy?: ConflictStrategy },
): Promise<ReconcileResult> {
	const localEntries = await localFileSystem.listEntries();
	const remoteEntries = await remoteFileSystem.listEntries();
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
			remoteMissingCount: undefined,
			remoteMissingSinceMs: undefined,
			lastSyncAt: nowTs,
		};
		if (prior?.conflict) {
			base.conflict = prior.conflict;
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
					conflictStrategy,
					prior,
				});
				if (decision.job) {
					jobs.push(decision.job);
				}
			} else if (!entry.local && entry.remote) {
				const decision = resolveRemoteOnlyDecision({
					path: entry.path,
					entryType: "folder",
					nowTs,
					conflictStrategy,
					prior,
					remoteId: entry.remote.id,
					remoteRev: entry.remote.revisionId,
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
				conflictStrategy,
				prior,
			});
			if (decision.job) {
				jobs.push(decision.job);
			}
		} else if (!entry.local && entry.remote) {
			const decision = resolveRemoteOnlyDecision({
				path: entry.path,
				entryType: "file",
				nowTs,
				conflictStrategy,
				prior,
				remoteId: entry.remote.id,
				remoteRev: entry.remote.revisionId,
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
				conflictStrategy,
				remoteId: entry.remote.id,
				remoteRev: entry.remote.revisionId,
				localMtimeMs: entry.local?.mtimeMs,
				localChanged,
				remoteChanged,
			});
			if (decision.conflict) {
				base.conflict = decision.conflict;
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
