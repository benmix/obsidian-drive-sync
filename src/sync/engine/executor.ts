import type { LocalFileSystem, RemoteFileSystem } from "../../filesystem";
import type { SyncEntry, SyncJob } from "../../data/sync-schema";
import { hashBytes } from "../support/hash";
import { now } from "../support/utils";

export type ExecuteResult = {
	entries: SyncEntry[];
	jobsExecuted: number;
	uploadBytes: number;
	downloadBytes: number;
};

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
			const stats = await localFileSystem.stat(job.path);
			const size = stats?.size ?? data.byteLength;
			const uploaded = await remoteFileSystem.uploadFile(job.path, data, {
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
				throw new Error(`Missing remote ID for download job: ${job.path}`);
			}
			const data = await remoteFileSystem.downloadFile(job.remoteId);
			await localFileSystem.writeFile(job.path, data);
			const stats = await localFileSystem.stat(job.path);
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
				throw new Error(`Missing copy-local paths for ${job.path}`);
			}
			const data = await localFileSystem.readFile(job.fromPath);
			await localFileSystem.writeFile(job.toPath, data);
			const stats = await localFileSystem.stat(job.toPath);
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
			await localFileSystem.deletePath(job.path);
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
			if (!job.remoteId || !remoteFileSystem.deletePath) {
				throw new Error(`Missing remote delete support for ${job.path}`);
			}
			await remoteFileSystem.deletePath(job.remoteId);
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
				throw new Error(`Missing move-local paths for ${job.path}`);
			}
			await localFileSystem.movePath(job.fromPath, job.toPath);
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
			if (!job.remoteId || !job.toPath || !remoteFileSystem.movePath) {
				throw new Error(`Missing move-remote data for ${job.path}`);
			}
			await remoteFileSystem.movePath(job.remoteId, job.toPath);
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
			await localFileSystem.createFolder(job.path);
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
			if (!remoteFileSystem.createFolder) {
				throw new Error("Remote create folder is not supported.");
			}
			const result = await remoteFileSystem.createFolder(job.path);
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
