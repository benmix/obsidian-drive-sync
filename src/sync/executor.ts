import type { LocalFileSystem, RemoteFileSystem } from "./types";
import type { SyncEntry, SyncJob } from "../data/sync-schema";
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
			const stats = await localFs.stat(job.path);
			const uploaded = await remoteFs.uploadFile(job.path, data, {
				mtimeMs: stats?.mtimeMs,
				size: stats?.size ?? data.byteLength,
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
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "download") {
			if (!job.remoteId) {
				throw new Error(`Missing remote ID for download job: ${job.path}`);
			}
			const data = await remoteFs.downloadFile(job.remoteId);
			await localFs.writeFile(job.path, data);
			const stats = await localFs.stat(job.path);
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
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "delete-local") {
			await localFs.deletePath(job.path);
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
				type: job.entryType ?? "file",
				tombstone: true,
				localMtimeMs: undefined,
				localSize: undefined,
				localHash: undefined,
				syncedLocalHash: undefined,
				conflict: undefined,
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
					type: job.entryType ?? "file",
					tombstone: true,
					localMtimeMs: undefined,
					localSize: undefined,
					localHash: undefined,
					syncedLocalHash: undefined,
					conflict: undefined,
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
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "create-local-folder") {
			await localFs.createFolder(job.path);
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
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		} else if (job.op === "create-remote-folder") {
			if (!remoteFs.createFolder) {
				throw new Error("Remote create folder is not supported.");
			}
			const result = await remoteFs.createFolder(job.path);
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
				lastSyncAt: now(),
			});
			jobsExecuted += 1;
		}
	}

	return { entries, jobsExecuted };
}
