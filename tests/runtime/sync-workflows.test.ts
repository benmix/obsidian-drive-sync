import { beforeEach, describe, expect, test, vi } from "vitest";

const harness = vi.hoisted(() => ({
	syncLocalToRemote: vi.fn(),
	syncRemoteToLocal: vi.fn(),
	pollRemoteChanges: vi.fn(),
	isInitializationPhase: vi.fn(),
	stateStoreLoad: vi.fn(),
	stateStoreSave: vi.fn(),
	syncEngineCtor: vi.fn(),
	engine: {
		load: vi.fn(),
		plan: vi.fn(),
		runOnce: vi.fn(),
		rebuildIndex: vi.fn(),
		getStateSnapshot: vi.fn(),
		applyEntries: vi.fn(),
		removeEntries: vi.fn(),
		enqueue: vi.fn(),
		save: vi.fn(),
		listJobs: vi.fn(),
	},
}));

vi.mock("@runtime/use-cases/manual-sync", () => ({
	syncLocalToRemote: harness.syncLocalToRemote,
	syncRemoteToLocal: harness.syncRemoteToLocal,
}));

vi.mock("@sync/planner/remote-poller", () => ({
	pollRemoteChanges: harness.pollRemoteChanges,
}));

vi.mock("@sync/planner/initialization", () => ({
	isInitializationPhase: harness.isInitializationPhase,
}));

vi.mock("@sync/state/state-store", () => ({
	PluginDataStateStore: class {
		async load() {
			return await harness.stateStoreLoad();
		}

		async save(state: unknown) {
			await harness.stateStoreSave(state);
		}
	},
}));

vi.mock("@sync/engine/sync-engine", () => ({
	SyncEngine: class {
		constructor(...args: unknown[]) {
			harness.syncEngineCtor(...args);
		}

		load = harness.engine.load;
		plan = harness.engine.plan;
		runOnce = harness.engine.runOnce;
		rebuildIndex = harness.engine.rebuildIndex;
		getStateSnapshot = harness.engine.getStateSnapshot;
		applyEntries = harness.engine.applyEntries;
		removeEntries = harness.engine.removeEntries;
		enqueue = harness.engine.enqueue;
		save = harness.engine.save;
		listJobs = harness.engine.listJobs;
	},
}));

import {
	estimateSyncPlan,
	pollRemoteSync,
	syncVaultToRemote,
} from "@runtime/use-cases/sync-workflows";

describe("sync workflow use cases", () => {
	beforeEach(() => {
		harness.syncLocalToRemote.mockReset();
		harness.syncRemoteToLocal.mockReset();
		harness.pollRemoteChanges.mockReset();
		harness.isInitializationPhase.mockReset();
		harness.stateStoreLoad.mockReset();
		harness.stateStoreSave.mockReset();
		harness.syncEngineCtor.mockReset();
		for (const fn of Object.values(harness.engine)) {
			fn.mockReset();
		}
		harness.engine.getStateSnapshot.mockReturnValue({
			entries: {},
			jobs: [],
			logs: [],
			runtimeMetrics: {},
		});
		harness.engine.load.mockResolvedValue();
		harness.isInitializationPhase.mockReturnValue(false);
	});

	test("syncVaultToRemote wires provider file systems into manual sync", async () => {
		const localFileSystem = { kind: "local" };
		const remoteFileSystem = { kind: "remote" };
		const app = { name: "app" };
		const client = { id: "client-1" };
		const localProvider = {
			createLocalFileSystem: vi.fn(() => localFileSystem),
		};
		const remoteProvider = {
			createRemoteFileSystem: vi.fn(() => remoteFileSystem),
		};
		harness.syncLocalToRemote.mockResolvedValue({
			uploaded: 2,
		});

		await expect(
			syncVaultToRemote(
				app as never,
				localProvider as never,
				remoteProvider as never,
				client as never,
				"scope-1",
			),
		).resolves.toEqual({
			uploaded: 2,
		});
		expect(localProvider.createLocalFileSystem).toHaveBeenCalledWith(app);
		expect(remoteProvider.createRemoteFileSystem).toHaveBeenCalledWith(client, "scope-1");
		expect(harness.syncLocalToRemote).toHaveBeenCalledWith(localFileSystem, remoteFileSystem);
	});

	test("estimateSyncPlan computes byte totals and restores the original state", async () => {
		const originalState = {
			entries: {
				"notes/existing.md": {
					relPath: "notes/existing.md",
					type: "file",
				},
			},
			jobs: [],
			logs: [],
			runtimeMetrics: {},
		};
		const localFileSystem = {
			listEntries: vi.fn(async () => [
				{
					path: "notes/upload.md",
					type: "file" as const,
					size: 11,
				},
			]),
		};
		const remoteFileSystem = {
			getEntry: vi.fn(async () => ({
				id: "remote-1",
				name: "download.md",
				type: "file" as const,
				size: 7,
			})),
		};
		const localProvider = {
			createLocalFileSystem: vi.fn(() => localFileSystem),
		};
		const remoteProvider = {
			createRemoteFileSystem: vi.fn(() => remoteFileSystem),
		};
		harness.stateStoreLoad.mockResolvedValue(originalState);
		harness.engine.plan.mockResolvedValue({
			jobsPlanned: 2,
			entries: 4,
		});
		harness.engine.listJobs.mockReturnValue([
			{
				op: "upload",
				path: "notes/upload.md",
			},
			{
				op: "download",
				path: "notes/download.md",
				remoteId: "remote-1",
			},
		]);

		await expect(
			estimateSyncPlan(
				{} as never,
				localProvider as never,
				remoteProvider as never,
				{} as never,
				"scope-1",
			),
		).resolves.toEqual({
			jobsPlanned: 2,
			entries: 4,
			uploadBytes: 11,
			downloadBytes: 7,
		});
		expect(harness.engine.plan).toHaveBeenCalledWith({
			preferRemoteSeed: false,
		});
		expect(harness.stateStoreSave).toHaveBeenCalledWith(originalState);
	});

	test("pollRemoteSync applies remote results and persists the cursor", async () => {
		const state = {
			entries: {},
			jobs: [],
			logs: [],
			runtimeMetrics: {},
		};
		const localFileSystem = {
			listEntries: vi.fn(async () => []),
		};
		const remoteFileSystem = {
			id: "remote-fs",
		};
		const localProvider = {
			createLocalFileSystem: vi.fn(() => localFileSystem),
		};
		const remoteProvider = {
			createRemoteFileSystem: vi.fn(() => remoteFileSystem),
		};
		const snapshot = [
			{
				relPath: "notes/remote.md",
				type: "file" as const,
			},
		];
		const job = {
			id: "job-1",
			op: "download" as const,
			path: "notes/remote.md",
			priority: 1,
			attempt: 0,
			nextRunAt: 1,
		};
		harness.stateStoreLoad.mockResolvedValue(state);
		harness.engine.getStateSnapshot.mockReturnValue(state);
		harness.isInitializationPhase.mockReturnValue(true);
		harness.pollRemoteChanges.mockResolvedValue({
			snapshot,
			removedPaths: ["notes/old.md"],
			jobs: [job],
			remoteEventCursor: "cursor-1",
		});

		await expect(
			pollRemoteSync(
				{} as never,
				localProvider as never,
				remoteProvider as never,
				{} as never,
				"scope-1",
				{
					syncStrategy: "bidirectional",
				},
			),
		).resolves.toEqual({
			jobsPlanned: 1,
			entries: 1,
		});
		expect(harness.pollRemoteChanges).toHaveBeenCalledWith(remoteFileSystem, state, {
			syncStrategy: "bidirectional",
			preferRemoteSeed: true,
		});
		expect(harness.engine.applyEntries).toHaveBeenCalledWith(snapshot);
		expect(harness.engine.removeEntries).toHaveBeenCalledWith(["notes/old.md"]);
		expect(harness.engine.enqueue).toHaveBeenCalledWith(job);
		expect(harness.engine.save).toHaveBeenCalledWith({
			remoteEventCursor: "cursor-1",
		});
	});
});
