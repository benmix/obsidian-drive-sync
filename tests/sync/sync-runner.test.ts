import { beforeEach, describe, expect, test, vi } from "vitest";

const harness = vi.hoisted(() => ({
	filterLocalChanges: vi.fn(),
	planLocalChanges: vi.fn(),
	pollRemoteChanges: vi.fn(),
	isInitializationPhase: vi.fn(),
	syncEngineCtor: vi.fn(),
	engine: {
		load: vi.fn(),
		getStateSnapshot: vi.fn(),
		applyEntries: vi.fn(),
		removeEntries: vi.fn(),
		rewritePaths: vi.fn(),
		enqueue: vi.fn(),
		save: vi.fn(),
		plan: vi.fn(),
		listJobs: vi.fn(),
		runOnce: vi.fn(),
	},
}));

vi.mock("@sync/planner/local-change-filter", () => ({
	filterLocalChanges: harness.filterLocalChanges,
}));

vi.mock("@sync/planner/local-change-planner", () => ({
	planLocalChanges: harness.planLocalChanges,
}));

vi.mock("@sync/planner/remote-poller", () => ({
	pollRemoteChanges: harness.pollRemoteChanges,
}));

vi.mock("@sync/planner/initialization", () => ({
	isInitializationPhase: harness.isInitializationPhase,
}));

vi.mock("@sync/engine/sync-engine", () => ({
	SyncEngine: class {
		constructor(...args: unknown[]) {
			harness.syncEngineCtor(...args);
		}

		load = harness.engine.load;
		getStateSnapshot = harness.engine.getStateSnapshot;
		applyEntries = harness.engine.applyEntries;
		removeEntries = harness.engine.removeEntries;
		rewritePaths = harness.engine.rewritePaths;
		enqueue = harness.engine.enqueue;
		save = harness.engine.save;
		plan = harness.engine.plan;
		listJobs = harness.engine.listJobs;
		runOnce = harness.engine.runOnce;
	},
}));

import { SyncRunner } from "@sync/use-cases/sync-runner";

describe("SyncRunner", () => {
	beforeEach(() => {
		harness.filterLocalChanges.mockReset();
		harness.planLocalChanges.mockReset();
		harness.pollRemoteChanges.mockReset();
		harness.isInitializationPhase.mockReset();
		harness.syncEngineCtor.mockReset();
		for (const fn of Object.values(harness.engine)) {
			fn.mockReset();
		}
		harness.engine.load.mockResolvedValue();
		harness.engine.getStateSnapshot.mockReturnValue({
			entries: {},
			jobs: [],
			logs: [],
			runtimeMetrics: {},
		});
		harness.engine.listJobs.mockReturnValue([]);
		harness.engine.plan.mockResolvedValue({
			jobsPlanned: 0,
			entries: 0,
		});
		harness.engine.runOnce.mockResolvedValue();
		harness.isInitializationPhase.mockReturnValue(false);
	});

	test("applies local plans and skips remote polling for local-only runs without reconcile", async () => {
		const localFileSystem = {
			listEntries: vi.fn(async () => [{ path: "notes/a.md", type: "file" as const }]),
		};
		const remoteFileSystem = { id: "remote-fs" };
		const localJob = {
			id: "job-local",
			op: "upload" as const,
			path: "notes/a.md",
			priority: 1,
			attempt: 0,
			nextRunAt: 1,
		};
		harness.filterLocalChanges.mockResolvedValue([
			{ type: "modify", path: "notes/a.md", entryType: "file" as const },
		]);
		harness.planLocalChanges.mockReturnValue({
			entries: [{ relPath: "notes/a.md", type: "file" as const }],
			removedPaths: ["notes/old.md"],
			rewritePrefixes: [{ from: "notes/old", to: "notes/new" }],
			jobs: [localJob],
		});

		const runner = new SyncRunner({} as never, {
			now: () => 100,
			backgroundReconcileIntervalMs: 1_000,
		});

		await runner.run(
			{
				trigger: "local",
				force: false,
				localChanges: [{ type: "modify", path: "notes/a.md", entryType: "file" }],
			},
			{
				localFileSystem: localFileSystem as never,
				remoteFileSystem: remoteFileSystem as never,
				syncStrategy: "bidirectional",
			},
		);

		expect(harness.filterLocalChanges).toHaveBeenCalledTimes(1);
		expect(harness.planLocalChanges).toHaveBeenCalledTimes(1);
		expect(harness.pollRemoteChanges).not.toHaveBeenCalled();
		expect(harness.engine.applyEntries).toHaveBeenCalledWith([
			{ relPath: "notes/a.md", type: "file" },
		]);
		expect(harness.engine.removeEntries).toHaveBeenCalledWith(["notes/old.md"]);
		expect(harness.engine.rewritePaths).toHaveBeenCalledWith([
			{ from: "notes/old", to: "notes/new" },
		]);
		expect(harness.engine.enqueue).toHaveBeenCalledWith(localJob);
		expect(harness.engine.save).toHaveBeenCalledWith({
			lastErrorAt: undefined,
			lastErrorCode: undefined,
			lastErrorCategory: undefined,
			lastErrorRetryable: undefined,
		});
		expect(harness.engine.runOnce).not.toHaveBeenCalled();
	});

	test("forces remote polling and reconcile, then executes queued jobs", async () => {
		const localFileSystem = {
			listEntries: vi.fn(async () => []),
		};
		const remoteFileSystem = { id: "remote-fs" };
		const queuedJob = {
			id: "job-remote",
			op: "download" as const,
			path: "notes/from-remote.md",
			priority: 1,
			attempt: 0,
			nextRunAt: 1,
		};
		const initialState = {
			entries: {},
			jobs: [],
			logs: [],
			runtimeMetrics: {},
		};
		harness.engine.getStateSnapshot.mockReturnValue(initialState);
		harness.isInitializationPhase.mockReturnValue(true);
		harness.pollRemoteChanges.mockResolvedValue({
			snapshot: [{ relPath: "notes/from-remote.md", type: "file" }],
			removedPaths: [],
			jobs: [queuedJob],
			remoteEventCursor: "cursor-1",
		});
		harness.engine.plan.mockResolvedValue({
			jobsPlanned: 1,
			entries: 1,
		});
		harness.engine.listJobs.mockReturnValue([queuedJob]);

		const runner = new SyncRunner({} as never, {
			now: () => 5_000,
			backgroundReconcileIntervalMs: 1_000,
		});

		await runner.run(
			{
				trigger: "manual",
				force: true,
				localChanges: [],
			},
			{
				localFileSystem: localFileSystem as never,
				remoteFileSystem: remoteFileSystem as never,
				syncStrategy: "bidirectional",
				onAuthError: vi.fn(),
			},
		);

		expect(harness.pollRemoteChanges).toHaveBeenCalledWith(remoteFileSystem, initialState, {
			syncStrategy: "bidirectional",
			preferRemoteSeed: true,
		});
		expect(harness.engine.save).toHaveBeenCalledWith({
			remoteEventCursor: "cursor-1",
		});
		expect(harness.engine.plan).toHaveBeenCalledWith({
			preferRemoteSeed: true,
		});
		expect(harness.engine.runOnce).toHaveBeenCalledTimes(1);
		expect(localFileSystem.listEntries).toHaveBeenCalledTimes(1);
	});
});
