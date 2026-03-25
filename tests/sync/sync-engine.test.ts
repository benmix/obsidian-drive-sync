import type { LocalFileSystem, RemoteFileSystem } from "@contracts/filesystem/file-system";
import type { SyncState } from "@contracts/sync/state";
import type { StateStore } from "@contracts/sync/state-store";
import { createDriveSyncError } from "@errors";
import { SyncEngine } from "@sync/engine/sync-engine";
import { createJob, createState, textBytes } from "@tests/helpers/sync-fixtures";
import { describe, expect, test, vi } from "vitest";

class MemoryStateStore implements StateStore {
	state: SyncState;

	constructor(state: SyncState) {
		this.state = state;
	}

	async load(): Promise<SyncState> {
		return this.state;
	}

	async save(state: SyncState): Promise<void> {
		this.state = state;
	}
}

function createLocalFs(): LocalFileSystem {
	return {
		listEntries: async () => [],
		listFileEntries: async () => [],
		listFolderEntries: async () => [],
		getEntry: async () => ({
			path: "notes/a.md",
			type: "file",
			size: 3,
			mtimeMs: 123,
		}),
		readFile: async () => textBytes("abc"),
		writeFile: async () => {},
		deleteEntry: async () => {},
		moveEntry: async () => {},
		ensureFolder: async () => {},
	};
}

function createRemoteFs(writeFile: RemoteFileSystem["writeFile"]): RemoteFileSystem {
	return {
		listEntries: async () => [],
		listFileEntries: async () => [],
		listFolderEntries: async () => [],
		getEntry: async () => null,
		readFile: async () => textBytes("remote"),
		writeFile,
	};
}

describe("SyncEngine", () => {
	test("records structured auth logs when a job is blocked by auth", async () => {
		const stateStore = new MemoryStateStore({
			...createState(),
			jobs: [createJob()],
		});
		const engine = new SyncEngine(
			createLocalFs(),
			createRemoteFs(async () => {
				throw createDriveSyncError("AUTH_REAUTH_REQUIRED", {
					category: "auth",
				});
			}),
			stateStore,
		);

		await engine.load();
		await engine.runOnce();

		expect(stateStore.state.lastErrorCode).toBe("AUTH_REAUTH_REQUIRED");
		expect(stateStore.state.jobs[0]).toMatchObject({
			status: "blocked",
			lastErrorCode: "AUTH_REAUTH_REQUIRED",
			lastErrorRetryable: false,
		});
		expect(stateStore.state.logs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "Job blocked by auth",
					context: "auth",
					code: "AUTH_REAUTH_REQUIRED",
					category: "auth",
					jobId: "job-1",
					jobOp: "upload",
					path: "notes/a.md",
				}),
			]),
		);
	});

	test("records structured retry logs when a retryable network error is scheduled", async () => {
		const stateStore = new MemoryStateStore({
			...createState(),
			jobs: [createJob()],
		});
		const engine = new SyncEngine(
			createLocalFs(),
			createRemoteFs(async () => {
				throw createDriveSyncError("NETWORK_RATE_LIMITED", {
					category: "network",
					retryable: true,
				});
			}),
			stateStore,
		);

		await engine.load();
		await engine.runOnce();

		expect(stateStore.state.lastErrorCode).toBe("NETWORK_RATE_LIMITED");
		expect(stateStore.state.jobs[0]).toMatchObject({
			status: "pending",
			attempt: 1,
			lastErrorCode: "NETWORK_RATE_LIMITED",
			lastErrorRetryable: true,
		});
		expect(stateStore.state.logs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "Job retry scheduled",
					context: "task",
					code: "NETWORK_RATE_LIMITED",
					category: "network",
					retryable: true,
					jobId: "job-1",
					jobOp: "upload",
					path: "notes/a.md",
				}),
			]),
		);
	});

	test("persists runtime metrics for a successful run", async () => {
		const stateStore = new MemoryStateStore({
			...createState(),
			jobs: [createJob()],
		});
		const engine = new SyncEngine(
			createLocalFs(),
			createRemoteFs(async () => ({
				id: "remote-a",
				revisionId: "rev-2",
			})),
			stateStore,
		);

		await engine.load();
		await expect(engine.runOnce()).resolves.toEqual({
			jobsExecuted: 1,
			entriesUpdated: 1,
		});

		expect(stateStore.state.runtimeMetrics).toMatchObject({
			lastRunJobsExecuted: 1,
			lastRunEntriesUpdated: 1,
			lastRunFailures: 0,
			totalRuns: 1,
			totalFailures: 0,
			totalUploadBytes: 3,
			totalDownloadBytes: 0,
			peakQueueDepth: 1,
			peakPendingJobs: 1,
			peakBlockedJobs: 0,
		});
	});

	test("invokes auth error callback when an auth failure pauses the run", async () => {
		const stateStore = new MemoryStateStore({
			...createState(),
			jobs: [createJob()],
		});
		const onAuthError = vi.fn();
		const engine = new SyncEngine(
			createLocalFs(),
			createRemoteFs(async () => {
				throw createDriveSyncError("AUTH_REAUTH_REQUIRED", {
					category: "auth",
				});
			}),
			stateStore,
			{ onAuthError },
		);

		await engine.load();
		await engine.runOnce();

		expect(onAuthError).toHaveBeenCalledTimes(1);
		expect(onAuthError).toHaveBeenCalledWith(
			expect.objectContaining({
				code: "AUTH_REAUTH_REQUIRED",
				category: "auth",
			}),
		);
	});
});
