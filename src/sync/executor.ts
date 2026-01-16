import type { LocalFileSystem, RemoteFileSystem } from "./types";
import type { SyncEntry, SyncJob } from "./index-types";
import { hashBytes } from "./hash";
import { now } from "./utils";

export type ExecuteResult = {
	entries: SyncEntry[];
	jobsExecuted: number;
};

export async function executeJobs(
	localFs: LocalFileSystem,
	remoteFs: RemoteFileSystem,
	jobs: SyncJob[],
): Promise<ExecuteResult> {
	const entries: SyncEntry[] = [];
	let jobsExecuted = 0;

	for (const job of jobs) {
		if (job.op === "upload") {
			const data = await localFs.readFile(job.path);
			await remoteFs.uploadFile(job.path, data);
			const localHash = await hashBytes(data);
			entries.push({
				relPath: job.path,
				type: "file",
				localHash,
				syncedLocalHash: localHash,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "download") {
			if (!job.remoteId) {
				throw new Error(`Missing remote ID for download job: ${job.path}`);
			}
			const data = await remoteFs.downloadFile(job.remoteId);
			await localFs.writeFile(job.path, data);
			const localHash = await hashBytes(data);
			entries.push({
				relPath: job.path,
				type: "file",
				localHash,
				syncedLocalHash: localHash,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "delete-local") {
			await localFs.deletePath(job.path);
			entries.push({
				relPath: job.path,
				type: "file",
				tombstone: true,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "delete-remote") {
			if (!job.remoteId || !remoteFs.deletePath) {
				throw new Error(`Missing remote delete support for ${job.path}`);
			}
			await remoteFs.deletePath(job.remoteId);
			entries.push({
				relPath: job.path,
				type: "file",
				tombstone: true,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "move-local") {
			if (!job.fromPath || !job.toPath) {
				throw new Error(`Missing move-local paths for ${job.path}`);
			}
			await localFs.movePath(job.fromPath, job.toPath);
			entries.push({
				relPath: job.fromPath,
				type: "file",
				tombstone: true,
				lastSyncAt: now(),
			});
			entries.push({
				relPath: job.toPath,
				type: "file",
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "move-remote") {
			if (!job.remoteId || !job.toPath || !remoteFs.movePath) {
				throw new Error(`Missing move-remote data for ${job.path}`);
			}
			await remoteFs.movePath(job.remoteId, job.toPath);
			if (job.fromPath) {
				entries.push({
					relPath: job.fromPath,
					type: "file",
					tombstone: true,
					lastSyncAt: now(),
				});
			}
			entries.push({
				relPath: job.toPath,
				type: "file",
				remoteId: job.remoteId,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		}
	}

	return { entries, jobsExecuted };
}
