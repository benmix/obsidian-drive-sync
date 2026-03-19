import type { SyncEntry, SyncJob } from "@contracts/data/sync-schema";
import type { LocalFileSystem, RemoteFileSystem } from "@contracts/filesystem/file-system";
import type { ExecuteResult } from "@contracts/sync/execution";
import { createDriveSyncError } from "@errors";
import { hashBytes } from "@sync/support/hash";
import { now } from "@sync/support/utils";

export async function executeJobs(
	localFileSystem: LocalFileSystem,
	remoteFileSystem: RemoteFileSystem,
	jobs: SyncJob[],
): Promise<ExecuteResult> {
	const entries: SyncEntry[] = [];
	let jobsExecuted = 0;
	let uploadBytes = 0;
	let downloadBytes = 0;

	for (const job of jobs) {
		if (job.op === "upload") {
			const data = await localFileSystem.readFile(job.path);
			const stats = await localFileSystem.getEntry(job.path);
			const size = stats?.size ?? data.byteLength;
			const uploaded = await remoteFileSystem.writeFile(job.path, data, {
				mtimeMs: stats?.mtimeMs,
				size,
			});
			const localHash = await hashBytes(data);
			entries.push({
				relPath: job.path,
				type: "file",
				localMtimeMs: stats?.mtimeMs,
				localSize: stats?.size ?? data.byteLength,
				localHash,
				syncedLocalHash: localHash,
				remoteId: uploaded.id,
				remoteRev: uploaded.revisionId,
				syncedRemoteRev: uploaded.revisionId,
				tombstone: false,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
			uploadBytes += size;
		} else if (job.op === "download") {
			if (!job.remoteId) {
				throw createDriveSyncError("SYNC_JOB_INVALID", {
					category: "sync",
					userMessage: "Sync job is invalid.",
					details: {
						jobId: job.id,
						op: job.op,
						path: job.path,
						missing: "remoteId",
					},
				});
			}
			const data = await remoteFileSystem.readFile(job.remoteId);
			await localFileSystem.writeFile(job.path, data);
			const stats = await localFileSystem.getEntry(job.path);
			const localHash = await hashBytes(data);
			entries.push({
				relPath: job.path,
				type: "file",
				localMtimeMs: stats?.mtimeMs,
				localSize: stats?.size ?? data.byteLength,
				localHash,
				syncedLocalHash: localHash,
				remoteId: job.remoteId,
				remoteRev: job.remoteRev,
				syncedRemoteRev: job.remoteRev,
				tombstone: false,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
			downloadBytes += data.byteLength;
		} else if (job.op === "copy-local") {
			if (!job.fromPath || !job.toPath) {
				throw createDriveSyncError("SYNC_JOB_INVALID", {
					category: "sync",
					userMessage: "Sync job is invalid.",
					details: {
						jobId: job.id,
						op: job.op,
						path: job.path,
						missing: "copyPaths",
					},
				});
			}
			const data = await localFileSystem.readFile(job.fromPath);
			await localFileSystem.writeFile(job.toPath, data);
			const stats = await localFileSystem.getEntry(job.toPath);
			const localHash = await hashBytes(data);
			entries.push({
				relPath: job.toPath,
				type: "file",
				localMtimeMs: stats?.mtimeMs,
				localSize: stats?.size ?? data.byteLength,
				localHash,
				syncedLocalHash: undefined,
				remoteId: undefined,
				remoteRev: undefined,
				syncedRemoteRev: undefined,
				tombstone: false,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "delete-local") {
			await localFileSystem.deleteEntry(job.path);
			entries.push({
				relPath: job.path,
				type: job.entryType ?? "file",
				tombstone: true,
				localMtimeMs: undefined,
				localSize: undefined,
				localHash: undefined,
				syncedLocalHash: undefined,
				remoteId: undefined,
				remoteRev: undefined,
				syncedRemoteRev: undefined,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "delete-remote") {
			if (!job.remoteId || !remoteFileSystem.deleteEntry) {
				throw createDriveSyncError(
					job.remoteId ? "REMOTE_UNSUPPORTED" : "SYNC_JOB_INVALID",
					{
						category: job.remoteId ? "provider" : "sync",
						userMessage: job.remoteId
							? "This remote operation is not supported."
							: "Sync job is invalid.",
						details: {
							jobId: job.id,
							op: job.op,
							path: job.path,
							missing: job.remoteId ? "deleteEntry" : "remoteId",
						},
					},
				);
			}
			await remoteFileSystem.deleteEntry(job.remoteId);
			entries.push({
				relPath: job.path,
				type: job.entryType ?? "file",
				tombstone: true,
				remoteId: job.remoteId,
				remoteRev: undefined,
				syncedRemoteRev: undefined,
				localMtimeMs: undefined,
				localSize: undefined,
				localHash: undefined,
				syncedLocalHash: undefined,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "move-local") {
			if (!job.fromPath || !job.toPath) {
				throw createDriveSyncError("SYNC_JOB_INVALID", {
					category: "sync",
					userMessage: "Sync job is invalid.",
					details: {
						jobId: job.id,
						op: job.op,
						path: job.path,
						missing: "movePaths",
					},
				});
			}
			await localFileSystem.moveEntry(job.fromPath, job.toPath);
			entries.push({
				relPath: job.fromPath,
				type: job.entryType ?? "file",
				tombstone: true,
				localMtimeMs: undefined,
				localSize: undefined,
				localHash: undefined,
				syncedLocalHash: undefined,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			entries.push({
				relPath: job.toPath,
				type: job.entryType ?? "file",
				remoteId: job.remoteId,
				remoteRev: job.remoteRev,
				syncedRemoteRev: job.remoteRev,
				localMtimeMs: undefined,
				localSize: undefined,
				localHash: undefined,
				syncedLocalHash: undefined,
				tombstone: false,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "move-remote") {
			if (!job.remoteId || !job.toPath || !remoteFileSystem.moveEntry) {
				throw createDriveSyncError(
					!remoteFileSystem.moveEntry ? "REMOTE_UNSUPPORTED" : "SYNC_JOB_INVALID",
					{
						category: !remoteFileSystem.moveEntry ? "provider" : "sync",
						userMessage: !remoteFileSystem.moveEntry
							? "This remote operation is not supported."
							: "Sync job is invalid.",
						details: {
							jobId: job.id,
							op: job.op,
							path: job.path,
							missing: !job.remoteId
								? "remoteId"
								: !job.toPath
									? "toPath"
									: "moveEntry",
						},
					},
				);
			}
			await remoteFileSystem.moveEntry(job.remoteId, job.toPath);
			if (job.fromPath) {
				entries.push({
					relPath: job.fromPath,
					type: job.entryType ?? "file",
					tombstone: true,
					localMtimeMs: undefined,
					localSize: undefined,
					localHash: undefined,
					syncedLocalHash: undefined,
					conflict: undefined,
					conflictPending: undefined,
					lastSyncAt: now(),
				});
			}
			entries.push({
				relPath: job.toPath,
				type: job.entryType ?? "file",
				remoteId: job.remoteId,
				remoteRev: job.remoteRev,
				syncedRemoteRev: job.remoteRev,
				localMtimeMs: undefined,
				localSize: undefined,
				localHash: undefined,
				syncedLocalHash: undefined,
				tombstone: false,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "create-local-folder") {
			await localFileSystem.ensureFolder(job.path);
			entries.push({
				relPath: job.path,
				type: "folder",
				remoteId: job.remoteId,
				localMtimeMs: undefined,
				localSize: undefined,
				localHash: undefined,
				syncedLocalHash: undefined,
				tombstone: false,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "create-remote-folder") {
			if (!remoteFileSystem.ensureFolder) {
				throw createDriveSyncError("REMOTE_UNSUPPORTED", {
					category: "provider",
					userMessage: "This remote operation is not supported.",
					details: {
						jobId: job.id,
						op: job.op,
						path: job.path,
						missing: "ensureFolder",
					},
				});
			}
			const result = await remoteFileSystem.ensureFolder(job.path);
			entries.push({
				relPath: job.path,
				type: "folder",
				remoteId: result.id,
				localMtimeMs: undefined,
				localSize: undefined,
				localHash: undefined,
				syncedLocalHash: undefined,
				tombstone: false,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		}
	}

	return { entries, jobsExecuted, uploadBytes, downloadBytes };
}
