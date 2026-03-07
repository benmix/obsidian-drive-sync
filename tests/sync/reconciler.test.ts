import { afterEach, describe, expect, test, vi } from "vitest";
import {
	createEntry,
	createLocalFileSystem,
	createRemoteFileSystem,
	createState,
	FIXED_NOW,
} from "../helpers/sync-fixtures";
import { reconcileSnapshot } from "../../src/sync/planner/reconciler";

describe("reconcileSnapshot", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("creates upload job for local-only new file", async () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const result = await reconcileSnapshot(
			createLocalFileSystem([{ path: "notes/new.md", type: "file", mtimeMs: 100, size: 42 }]),
			createRemoteFileSystem([]),
			createState(),
		);

		expect(result.jobs).toEqual([
			expect.objectContaining({
				op: "upload",
				path: "notes/new.md",
				reason: "local-only",
			}),
		]);
		expect(result.snapshot).toContainEqual(
			expect.objectContaining({
				relPath: "notes/new.md",
				localMtimeMs: 100,
				localSize: 42,
			}),
		);
	});

	test("keeps remote mapping on first missing round and does not schedule job", async () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState([
			createEntry({
				relPath: "notes/a.md",
				type: "file",
				remoteId: "remote-a",
				remoteRev: "rev-a",
				syncedRemoteRev: "rev-a",
			}),
		]);

		const result = await reconcileSnapshot(
			createLocalFileSystem([{ path: "notes/a.md", type: "file", mtimeMs: 200, size: 10 }]),
			createRemoteFileSystem([]),
			state,
			{ syncStrategy: "remote_win" },
		);

		expect(result.jobs).toEqual([]);
		expect(result.snapshot).toContainEqual(
			expect.objectContaining({
				relPath: "notes/a.md",
				remoteId: "remote-a",
				remoteMissingCount: 1,
				remoteMissingSinceMs: FIXED_NOW,
			}),
		);
	});

	test("deletes local file on confirmed missing remote with remote_win", async () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState([
			createEntry({
				relPath: "notes/a.md",
				type: "file",
				remoteId: "remote-a",
				remoteMissingCount: 1,
				remoteMissingSinceMs: FIXED_NOW - 1000,
			}),
		]);

		const result = await reconcileSnapshot(
			createLocalFileSystem([{ path: "notes/a.md", type: "file", mtimeMs: 200, size: 10 }]),
			createRemoteFileSystem([]),
			state,
			{ syncStrategy: "remote_win" },
		);

		expect(result.jobs).toEqual([
			expect.objectContaining({
				op: "delete-local",
				path: "notes/a.md",
				reason: "remote-delete",
			}),
		]);
	});

	test("schedules delete-remote for remote-only item with local tombstone", async () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState([
			createEntry({
				relPath: "notes/a.md",
				type: "file",
				remoteId: "remote-a",
				tombstone: true,
			}),
		]);

		const result = await reconcileSnapshot(
			createLocalFileSystem([]),
			createRemoteFileSystem([
				{
					id: "remote-a",
					name: "a.md",
					path: "notes/a.md",
					type: "file",
					revisionId: "rev-b",
				},
			]),
			state,
			{ syncStrategy: "local_win" },
		);

		expect(result.jobs).toEqual([
			expect.objectContaining({
				op: "delete-remote",
				path: "notes/a.md",
				reason: "local-delete-pending",
			}),
		]);
		expect(result.snapshot[0]?.tombstone).toBe(true);
	});

	test("bidirectional both-changed marks conflict pending and creates conflict copy", async () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState([
			createEntry({
				relPath: "notes/a.md",
				type: "file",
				localMtimeMs: 100,
				localSize: 5,
				remoteId: "remote-a",
				remoteRev: "rev-a",
				syncedRemoteRev: "rev-a",
			}),
		]);

		const result = await reconcileSnapshot(
			createLocalFileSystem([{ path: "notes/a.md", type: "file", mtimeMs: 200, size: 5 }]),
			createRemoteFileSystem([
				{
					id: "remote-a",
					name: "a.md",
					path: "notes/a.md",
					type: "file",
					revisionId: "rev-b",
				},
			]),
			state,
			{ syncStrategy: "bidirectional" },
		);

		expect(result.jobs).toHaveLength(1);
		expect(result.jobs[0]).toMatchObject({
			op: "download",
			reason: "conflict-copy",
		});
		expect(result.snapshot[0]?.conflictPending).toBe(true);
		expect(result.snapshot[0]?.conflict).toMatchObject({
			remoteId: "remote-a",
			remoteRev: "rev-b",
			detectedAt: FIXED_NOW,
		});
	});

	test("initialization remote seed overrides local_win remote-only delete", async () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState();

		const result = await reconcileSnapshot(
			createLocalFileSystem([]),
			createRemoteFileSystem([
				{
					id: "remote-a",
					name: "a.md",
					path: "notes/a.md",
					type: "file",
					revisionId: "rev-a",
				},
			]),
			state,
			{ syncStrategy: "local_win" },
		);

		expect(result.jobs).toEqual([
			expect.objectContaining({
				op: "download",
				path: "notes/a.md",
				reason: "initial-remote-seed",
			}),
		]);
	});

	test("after initialization local_win handles remote-only as delete-remote", async () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState();
		state.lastSyncAt = FIXED_NOW - 1_000;

		const result = await reconcileSnapshot(
			createLocalFileSystem([]),
			createRemoteFileSystem([
				{
					id: "remote-a",
					name: "a.md",
					path: "notes/a.md",
					type: "file",
					revisionId: "rev-a",
				},
			]),
			state,
			{ syncStrategy: "local_win" },
		);

		expect(result.jobs).toEqual([
			expect.objectContaining({
				op: "delete-remote",
				path: "notes/a.md",
				reason: "local-missing",
			}),
		]);
	});

	test("enqueues cleanup for tracked paths missing on both sides", async () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState([
			createEntry({
				relPath: "notes/stale.md",
				type: "file",
				remoteId: "remote-stale",
			}),
		]);

		const result = await reconcileSnapshot(
			createLocalFileSystem([]),
			createRemoteFileSystem([]),
			state,
		);

		expect(result.jobs).toEqual([
			expect.objectContaining({
				op: "delete-remote",
				path: "notes/stale.md",
				reason: "local-missing",
			}),
		]);
		expect(result.snapshot).toEqual([]);
	});
});
