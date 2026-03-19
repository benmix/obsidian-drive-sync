import type { SyncEntry, SyncJob } from "@contracts/data/sync-schema";
import type { EntryType } from "@contracts/filesystem/entry";
import type {
	BothChangedDecision,
	PresenceDecision,
	RemoteMissingConfirmation,
} from "@contracts/sync/presence-policy";
import type { SyncStrategy } from "@contracts/sync/strategy";
import { compareMtimeWithTolerance } from "@sync/planner/mtime";
import { buildConflictName } from "@sync/support/utils";

export const REMOTE_MISSING_CONFIRM_ROUNDS = 2;

type DecisionInput = {
	path: string;
	entryType: EntryType;
	nowTs: number;
	syncStrategy: SyncStrategy;
	prior?: SyncEntry;
	remoteId?: string;
	remoteRev?: string;
	preferRemoteSeed?: boolean;
};

type BothChangedInput = {
	path: string;
	nowTs: number;
	syncStrategy: SyncStrategy;
	remoteId?: string;
	remoteRev?: string;
	localMtimeMs?: number;
	prior?: SyncEntry;
};

type BothPresentInput = {
	path: string;
	nowTs: number;
	syncStrategy: SyncStrategy;
	remoteId?: string;
	remoteRev?: string;
	remoteMtimeMs?: number;
	localMtimeMs?: number;
	localChanged: boolean;
	remoteChanged: boolean;
	prior?: SyncEntry;
	initializationPhase?: boolean;
};

type TrackedMissingInput = {
	path: string;
	nowTs: number;
	prior: SyncEntry;
};

export function resolveLocalOnlyDecision(input: DecisionInput): PresenceDecision {
	const hadRemoteBefore = Boolean(input.prior?.remoteId);
	if (input.prior?.conflictPending) {
		return {};
	}

	if (hadRemoteBefore && input.syncStrategy === "remote_win") {
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
	if (input.prior?.conflictPending) {
		return {};
	}
	if (input.prior?.tombstone && remoteId && input.syncStrategy !== "remote_win") {
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

	if (!remoteId) {
		return {};
	}

	if (input.preferRemoteSeed) {
		return buildRemoteToLocalJob(
			input.path,
			input.entryType,
			input.nowTs,
			remoteId,
			input.remoteRev,
			"initial-remote-seed",
		);
	}

	if (input.syncStrategy === "local_win") {
		return {
			job: {
				id: `delete-remote:${input.path}`,
				op: "delete-remote",
				path: input.path,
				remoteId,
				entryType: input.entryType,
				priority: input.entryType === "folder" ? 25 : 20,
				attempt: 0,
				nextRunAt: input.nowTs,
				reason: input.entryType === "folder" ? "local-folder-missing" : "local-missing",
			},
		};
	}

	return buildRemoteToLocalJob(
		input.path,
		input.entryType,
		input.nowTs,
		remoteId,
		input.remoteRev,
		input.entryType === "folder" ? "remote-folder" : "remote-only",
	);
}

export function resolveBothChangedDecision(input: BothChangedInput): BothChangedDecision {
	if (input.prior?.conflictPending) {
		return {
			jobs: [],
			conflict: input.prior.conflict,
			conflictPending: true,
		};
	}

	if (input.syncStrategy === "remote_win") {
		const jobs: SyncJob[] = [];
		const localBackupPath = buildConflictName(input.path, input.nowTs, "local");
		jobs.push({
			id: `copy-local:${input.path}:${input.nowTs}`,
			op: "copy-local",
			path: input.path,
			fromPath: input.path,
			toPath: localBackupPath,
			entryType: "file",
			priority: 11,
			attempt: 0,
			nextRunAt: input.nowTs,
			reason: "conflict-backup-local",
		});
		if (input.remoteId) {
			jobs.push({
				id: `download:${input.remoteId}`,
				op: "download",
				path: input.path,
				remoteId: input.remoteId,
				remoteRev: input.remoteRev,
				entryType: "file",
				priority: 10,
				attempt: 0,
				nextRunAt: input.nowTs,
				reason: "conflict-remote-win",
			});
		}
		return { jobs };
	}

	if (input.syncStrategy === "bidirectional") {
		const jobs: SyncJob[] = [];
		if (input.remoteId) {
			const conflictPath = buildConflictName(input.path, input.nowTs, "remote");
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
				reason: "conflict-copy",
			});
		}
		return {
			conflict: {
				localMtimeMs: input.localMtimeMs,
				remoteRev: input.remoteRev,
				remoteId: input.remoteId,
				detectedAt: input.nowTs,
			},
			conflictPending: true,
			jobs,
		};
	}

	const jobs: SyncJob[] = [];
	if (input.remoteId) {
		const conflictPath = buildConflictName(input.path, input.nowTs, "remote");
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
			reason: "conflict-copy",
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
		reason: "conflict-local-win",
	});
	return { jobs };
}

export function resolveBothPresentDecision(input: BothPresentInput): BothChangedDecision {
	if (input.prior?.conflictPending) {
		return {
			jobs: [],
			conflict: input.prior.conflict,
			conflictPending: true,
		};
	}

	if (
		input.initializationPhase &&
		input.syncStrategy === "bidirectional" &&
		input.localChanged &&
		input.remoteChanged
	) {
		const mtimeOrder = compareMtimeWithTolerance(input.localMtimeMs, input.remoteMtimeMs);
		if (mtimeOrder === 1) {
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
						reason: "initial-local-newer",
					},
				],
			};
		}
		if (mtimeOrder === -1 && input.remoteId) {
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
						reason: "initial-remote-newer",
					},
				],
			};
		}
	}

	if (input.localChanged && input.remoteChanged) {
		return resolveBothChangedDecision({
			path: input.path,
			nowTs: input.nowTs,
			syncStrategy: input.syncStrategy,
			remoteId: input.remoteId,
			remoteRev: input.remoteRev,
			localMtimeMs: input.localMtimeMs,
			prior: input.prior,
		});
	}

	if (input.localChanged) {
		if (input.syncStrategy === "remote_win" && input.remoteId) {
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
						reason: "remote-authority",
					},
				],
			};
		}
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
					reason: "local-change",
				},
			],
		};
	}

	if (input.remoteChanged) {
		if (input.syncStrategy === "local_win") {
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
						reason: "local-authority",
					},
				],
			};
		}
		if (input.remoteId) {
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
						reason: "remote-change",
					},
				],
			};
		}
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

function buildRemoteToLocalJob(
	path: string,
	entryType: EntryType,
	nowTs: number,
	remoteId: string,
	remoteRev: string | undefined,
	reason: string,
): PresenceDecision {
	if (entryType === "folder") {
		return {
			job: {
				id: `create-local-folder:${path}`,
				op: "create-local-folder",
				path,
				entryType: "folder",
				remoteId,
				priority: 2,
				attempt: 0,
				nextRunAt: nowTs,
				reason,
			},
		};
	}

	return {
		job: {
			id: `download:${remoteId}`,
			op: "download",
			path,
			remoteId,
			remoteRev,
			entryType: "file",
			priority: 10,
			attempt: 0,
			nextRunAt: nowTs,
			reason,
		},
	};
}
