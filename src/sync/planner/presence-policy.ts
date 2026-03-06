import type { EntryType, SyncEntry, SyncJob } from "../../data/sync-schema";
import { buildConflictName } from "../support/utils";

export type ConflictStrategy = "local-wins" | "remote-wins" | "manual";

const MANUAL_CONFLICT_HOLD_MS = 1000 * 60 * 60 * 24 * 365;
export const REMOTE_MISSING_CONFIRM_ROUNDS = 2;

type DecisionInput = {
	path: string;
	entryType: EntryType;
	nowTs: number;
	conflictStrategy: ConflictStrategy;
	prior?: SyncEntry;
	remoteId?: string;
	remoteRev?: string;
};

export type PresenceDecision = {
	job?: SyncJob;
	// Used when a prior remote mapping is stale and should be discarded immediately.
	removePriorPath?: boolean;
};

type BothChangedInput = {
	path: string;
	nowTs: number;
	conflictStrategy: ConflictStrategy;
	remoteId?: string;
	remoteRev?: string;
	localMtimeMs?: number;
};

export type BothChangedDecision = {
	jobs: SyncJob[];
	conflict?: SyncEntry["conflict"];
};

type BothPresentInput = {
	path: string;
	nowTs: number;
	conflictStrategy: ConflictStrategy;
	remoteId?: string;
	remoteRev?: string;
	localMtimeMs?: number;
	localChanged: boolean;
	remoteChanged: boolean;
};

type TrackedMissingInput = {
	path: string;
	nowTs: number;
	prior: SyncEntry;
};

export type RemoteMissingConfirmation = {
	confirmed: boolean;
	nextCount: number;
	sinceMs: number;
};

export function resolveLocalOnlyDecision(input: DecisionInput): PresenceDecision {
	const hadRemoteBefore = Boolean(input.prior?.remoteId);
	if (hadRemoteBefore && input.conflictStrategy === "remote-wins") {
		return {
			job: buildDeleteLocalJob(
				input.path,
				input.entryType,
				input.nowTs,
				input.entryType === "folder" ? "remote-folder-delete" : "remote-delete",
			),
			removePriorPath: false,
		};
	}

	if (input.entryType === "folder") {
		return {
			job: {
				id: `create-remote-folder:${input.path}`,
				op: "create-remote-folder",
				path: input.path,
				entryType: "folder",
				priority: 8,
				attempt: 0,
				nextRunAt: input.nowTs,
				reason: hadRemoteBefore ? "remote-folder-missing" : "local-folder",
			},
			removePriorPath: hadRemoteBefore,
		};
	}

	return {
		job: {
			id: `upload:${input.path}`,
			op: "upload",
			path: input.path,
			entryType: "file",
			priority: 5,
			attempt: 0,
			nextRunAt: input.nowTs,
			reason: hadRemoteBefore ? "remote-missing" : "local-only",
		},
		removePriorPath: hadRemoteBefore,
	};
}

export function resolveRemoteOnlyDecision(input: DecisionInput): PresenceDecision {
	const remoteId = input.remoteId ?? input.prior?.remoteId;
	if (input.prior?.tombstone && remoteId && input.conflictStrategy !== "remote-wins") {
		return {
			job: {
				id: `delete-remote:${input.path}`,
				op: "delete-remote",
				path: input.path,
				remoteId,
				entryType: input.entryType,
				priority: 20,
				attempt: 0,
				nextRunAt: input.nowTs,
				reason: "local-delete-pending",
			},
		};
	}

	if (input.entryType === "folder") {
		if (!remoteId) {
			return {};
		}
		return {
			job: {
				id: `create-local-folder:${input.path}`,
				op: "create-local-folder",
				path: input.path,
				entryType: "folder",
				remoteId,
				priority: 2,
				attempt: 0,
				nextRunAt: input.nowTs,
				reason: "remote-folder",
			},
		};
	}

	if (!remoteId) {
		return {};
	}

	return {
		job: {
			id: `download:${remoteId}`,
			op: "download",
			path: input.path,
			remoteId,
			remoteRev: input.remoteRev,
			entryType: "file",
			priority: 10,
			attempt: 0,
			nextRunAt: input.nowTs,
			reason: "remote-only",
		},
	};
}

export function resolveBothChangedDecision(input: BothChangedInput): BothChangedDecision {
	if (input.conflictStrategy === "manual") {
		return {
			conflict: {
				localMtimeMs: input.localMtimeMs,
				remoteRev: input.remoteRev,
				remoteId: input.remoteId,
				detectedAt: input.nowTs,
			},
			jobs: [
				{
					id: `conflict:${input.path}:${input.nowTs}`,
					op: "download",
					path: input.path,
					entryType: "file",
					priority: 1,
					attempt: 0,
					nextRunAt: input.nowTs + MANUAL_CONFLICT_HOLD_MS,
					reason: "conflict-manual",
				},
			],
		};
	}

	if (input.conflictStrategy === "remote-wins") {
		if (!input.remoteId) {
			return { jobs: [] };
		}
		return {
			jobs: [
				{
					id: `download:${input.remoteId}`,
					op: "download",
					path: input.path,
					remoteId: input.remoteId,
					remoteRev: input.remoteRev,
					entryType: "file",
					priority: 5,
					attempt: 0,
					nextRunAt: input.nowTs,
					reason: "conflict-remote-wins",
				},
			],
		};
	}

	const jobs: SyncJob[] = [];
	if (input.remoteId) {
		const conflictPath = buildConflictName(input.path, input.nowTs);
		jobs.push({
			id: `download:${input.remoteId}:conflict`,
			op: "download",
			path: conflictPath,
			remoteId: input.remoteId,
			remoteRev: input.remoteRev,
			entryType: "file",
			priority: 1,
			attempt: 0,
			nextRunAt: input.nowTs,
			reason: "conflict",
		});
	}
	jobs.push({
		id: `upload:${input.path}`,
		op: "upload",
		path: input.path,
		entryType: "file",
		priority: 5,
		attempt: 0,
		nextRunAt: input.nowTs,
		reason: "conflict-local-wins",
	});
	return { jobs };
}

export function resolveBothPresentDecision(input: BothPresentInput): BothChangedDecision {
	if (input.localChanged && input.remoteChanged) {
		return resolveBothChangedDecision({
			path: input.path,
			nowTs: input.nowTs,
			conflictStrategy: input.conflictStrategy,
			remoteId: input.remoteId,
			remoteRev: input.remoteRev,
			localMtimeMs: input.localMtimeMs,
		});
	}

	if (input.localChanged) {
		return {
			jobs: [
				{
					id: `upload:${input.path}`,
					op: "upload",
					path: input.path,
					entryType: "file",
					priority: 5,
					attempt: 0,
					nextRunAt: input.nowTs,
				},
			],
		};
	}

	if (input.remoteChanged && input.remoteId) {
		return {
			jobs: [
				{
					id: `download:${input.remoteId}`,
					op: "download",
					path: input.path,
					remoteId: input.remoteId,
					remoteRev: input.remoteRev,
					entryType: "file",
					priority: 10,
					attempt: 0,
					nextRunAt: input.nowTs,
				},
			],
		};
	}

	return { jobs: [] };
}

export function resolveTrackedMissingDecision(input: TrackedMissingInput): PresenceDecision {
	if (input.prior.remoteId) {
		return {
			job: {
				id: `delete-remote:${input.path}`,
				op: "delete-remote",
				path: input.path,
				remoteId: input.prior.remoteId,
				entryType: input.prior.type,
				priority: 20,
				attempt: 0,
				nextRunAt: input.nowTs,
				reason: "local-missing",
			},
		};
	}

	return {
		job: {
			id: `delete-local:${input.path}`,
			op: "delete-local",
			path: input.path,
			entryType: input.prior.type,
			priority: 20,
			attempt: 0,
			nextRunAt: input.nowTs,
			reason: "remote-missing",
		},
	};
}

export function evaluateRemoteMissingConfirmation(
	prior: SyncEntry,
	nowTs: number,
): RemoteMissingConfirmation {
	const nextCount = (prior.remoteMissingCount ?? 0) + 1;
	return {
		confirmed: nextCount >= REMOTE_MISSING_CONFIRM_ROUNDS,
		nextCount,
		sinceMs: prior.remoteMissingSinceMs ?? nowTs,
	};
}

function buildDeleteLocalJob(
	path: string,
	entryType: EntryType,
	nowTs: number,
	reason: string,
): SyncJob {
	return {
		id: `delete-local:${path}`,
		op: "delete-local",
		path,
		entryType,
		priority: entryType === "folder" ? 25 : 20,
		attempt: 0,
		nextRunAt: nowTs,
		reason,
	};
}
