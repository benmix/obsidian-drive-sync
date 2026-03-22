import type { SyncEntry, SyncJob } from "@contracts/data/sync-schema";
import type { LocalFileSystem, RemoteFileSystem } from "@contracts/filesystem/file-system";
import type { ExecuteResult } from "@contracts/sync/execution";
import { createDriveSyncError } from "@errors";
import { assertExecutableJob } from "@sync/engine/job-validation";
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
		const executableJob = assertExecutableJob(job);
		if (executableJob.op === "upload") {
			const data = await localFileSystem.readFile(executableJob.path);
			const stats = await localFileSystem.getEntry(job.path);
			const size = stats?.size ?? data.byteLength;
			const uploaded = await remoteFileSystem.writeFile(executableJob.path, data, {
				mtimeMs: stats?.mtimeMs,
				size,
			});
			const localHash = await hashBytes(data);
			entries.push({
				relPath: executableJob.path,
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
		} else if (executableJob.op === "download") {
			const data = await remoteFileSystem.readFile(executableJob.remoteId);
			await localFileSystem.writeFile(executableJob.path, data);
			const stats = await localFileSystem.getEntry(executableJob.path);
			const localHash = await hashBytes(data);
			entries.push({
				relPath: executableJob.path,
				type: "file",
				localMtimeMs: stats?.mtimeMs,
				localSize: stats?.size ?? data.byteLength,
				localHash,
				syncedLocalHash: localHash,
				remoteId: executableJob.remoteId,
				remoteRev: executableJob.remoteRev,
				syncedRemoteRev: executableJob.remoteRev,
				tombstone: false,
				conflict: undefined,
				conflictPending: undefined,
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
			downloadBytes += data.byteLength;
		} else if (executableJob.op === "copy-local") {
			const data = await localFileSystem.readFile(executableJob.fromPath);
			await localFileSystem.writeFile(executableJob.toPath, data);
			const stats = await localFileSystem.getEntry(executableJob.toPath);
			const localHash = await hashBytes(data);
			entries.push({
				relPath: executableJob.toPath,
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
		} else if (executableJob.op === "delete-local") {
			await localFileSystem.deleteEntry(executableJob.path);
			entries.push({
				relPath: executableJob.path,
				type: executableJob.entryType ?? "file",
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
		} else if (executableJob.op === "delete-remote") {
			if (!remoteFileSystem.deleteEntry) {
				throw createDriveSyncError("REMOTE_UNSUPPORTED", {
					category: "provider",
					userMessage: "This remote operation is not supported.",
					details: {
						jobId: executableJob.id,
						op: executableJob.op,
						path: executableJob.path,
						missing: "deleteEntry",
					},
				});
			}
			await remoteFileSystem.deleteEntry(executableJob.remoteId);
			entries.push({
				relPath: executableJob.path,
				type: executableJob.entryType ?? "file",
				tombstone: true,
				remoteId: executableJob.remoteId,
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
		} else if (executableJob.op === "move-local") {
			await localFileSystem.moveEntry(executableJob.fromPath, executableJob.toPath);
			entries.push({
				relPath: executableJob.fromPath,
				type: executableJob.entryType ?? "file",
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
				relPath: executableJob.toPath,
				type: executableJob.entryType ?? "file",
				remoteId: executableJob.remoteId,
				remoteRev: executableJob.remoteRev,
				syncedRemoteRev: executableJob.remoteRev,
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
		} else if (executableJob.op === "move-remote") {
			if (!remoteFileSystem.moveEntry) {
				throw createDriveSyncError("REMOTE_UNSUPPORTED", {
					category: "provider",
					userMessage: "This remote operation is not supported.",
					details: {
						jobId: executableJob.id,
						op: executableJob.op,
						path: executableJob.path,
						missing: "moveEntry",
					},
				});
			}
			await remoteFileSystem.moveEntry(executableJob.remoteId, executableJob.toPath);
			if (executableJob.fromPath) {
				entries.push({
					relPath: executableJob.fromPath,
					type: executableJob.entryType ?? "file",
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
				relPath: executableJob.toPath,
				type: executableJob.entryType ?? "file",
				remoteId: executableJob.remoteId,
				remoteRev: executableJob.remoteRev,
				syncedRemoteRev: executableJob.remoteRev,
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
		} else if (executableJob.op === "create-local-folder") {
			await localFileSystem.ensureFolder(executableJob.path);
			entries.push({
				relPath: executableJob.path,
				type: "folder",
				remoteId: executableJob.remoteId,
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
		} else if (executableJob.op === "create-remote-folder") {
			if (!remoteFileSystem.ensureFolder) {
				throw createDriveSyncError("REMOTE_UNSUPPORTED", {
					category: "provider",
					userMessage: "This remote operation is not supported.",
					details: {
						jobId: executableJob.id,
						op: executableJob.op,
						path: executableJob.path,
						missing: "ensureFolder",
					},
				});
			}
			const result = await remoteFileSystem.ensureFolder(executableJob.path);
			entries.push({
				relPath: executableJob.path,
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
