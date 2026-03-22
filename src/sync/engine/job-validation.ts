import type { SyncJob } from "@contracts/data/sync-schema";
import { createDriveSyncError } from "@errors";

export type ExecutableSyncJob =
	| (SyncJob & { op: "upload" })
	| (SyncJob & { op: "download"; remoteId: string })
	| (SyncJob & { op: "copy-local"; fromPath: string; toPath: string })
	| (SyncJob & { op: "delete-local" })
	| (SyncJob & { op: "delete-remote"; remoteId: string })
	| (SyncJob & { op: "move-local"; fromPath: string; toPath: string })
	| (SyncJob & { op: "move-remote"; remoteId: string; toPath: string })
	| (SyncJob & { op: "create-local-folder" })
	| (SyncJob & { op: "create-remote-folder" });

export function isExecutableJob(job: SyncJob): job is ExecutableSyncJob {
	return getInvalidJobReason(job) === undefined;
}

export function assertExecutableJob(job: SyncJob): ExecutableSyncJob {
	const missing = getInvalidJobReason(job);
	if (!missing) {
		return job as ExecutableSyncJob;
	}
	throw createDriveSyncError("SYNC_JOB_INVALID", {
		category: "sync",
		userMessage: "Sync job is invalid.",
		details: {
			jobId: job.id,
			op: job.op,
			path: job.path,
			missing,
		},
	});
}

function getInvalidJobReason(job: SyncJob): string | undefined {
	switch (job.op) {
		case "download":
		case "delete-remote":
			return job.remoteId ? undefined : "remoteId";
		case "copy-local":
			return job.fromPath && job.toPath ? undefined : "copyPaths";
		case "move-local":
			return job.fromPath && job.toPath ? undefined : "movePaths";
		case "move-remote":
			if (!job.remoteId) {
				return "remoteId";
			}
			return job.toPath ? undefined : "toPath";
		default:
			return undefined;
	}
}
