import { pollRemoteChanges } from "@sync/planner/remote-poller";
import { createEntry, createState } from "@tests/helpers/sync-fixtures";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("pollRemoteChanges", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test("advances remote event cursor from actual subscription events", async () => {
		vi.useFakeTimers();
		const listEntries = vi.fn(async () => []);
		const getEntry = vi.fn(async () => ({
			id: "file-1",
			name: "note.md",
			path: "note.md",
			type: "file" as const,
			parentId: "root",
			revisionId: "rev-1",
		}));
		const subscribeToEntryChanges = vi.fn(
			async (_scope: string, onEvent: (event: unknown) => Promise<void>) => {
				await onEvent({
					type: "node_updated",
					entryId: "file-1",
					eventId: "event-123",
				});
				return {
					dispose: () => {},
				};
			},
		);
		const remoteFileSystem = {
			getRootEntry: async () => ({
				id: "root",
				name: "root",
				type: "folder" as const,
				eventScopeId: "volume-1",
			}),
			subscribeToEntryChanges,
			setLatestEventCursor: vi.fn(),
			getLatestEventCursor: vi.fn(() => null),
			getEntry,
			listEntries,
			listFileEntries: vi.fn(async () => []),
			listFolderEntries: vi.fn(async () => []),
			readFile: vi.fn(async () => new Uint8Array()),
			writeFile: vi.fn(async () => ({})),
		};

		const resultPromise = pollRemoteChanges(remoteFileSystem, createState(), {});
		await vi.advanceTimersByTimeAsync(750);
		const result = await resultPromise;

		expect(result.remoteEventCursor).toBe("event-123");
		expect(subscribeToEntryChanges).toHaveBeenCalledWith("volume-1", expect.any(Function));
		expect(listEntries).not.toHaveBeenCalled();
		expect(getEntry).toHaveBeenCalledWith("file-1");
	});

	test("falls back to a full refresh when tree refresh events are emitted", async () => {
		vi.useFakeTimers();
		const listEntries = vi.fn(async () => [
			{
				id: "file-2",
				name: "full-refresh.md",
				path: "full-refresh.md",
				type: "file" as const,
				parentId: "root",
				revisionId: "rev-2",
			},
		]);
		const setLatestEventCursor = vi.fn();
		const remoteFileSystem = {
			getRootEntry: async () => ({
				id: "root",
				name: "root",
				type: "folder" as const,
				eventScopeId: "volume-1",
			}),
			subscribeToEntryChanges: vi.fn(
				async (_scope: string, onEvent: (event: unknown) => Promise<void>) => {
					await onEvent({
						type: "tree_refresh",
						eventId: "event-200",
					});
					return {
						dispose: () => {},
					};
				},
			),
			setLatestEventCursor,
			getLatestEventCursor: vi.fn(() => null),
			getEntry: vi.fn(async () => null),
			listEntries,
			listFileEntries: vi.fn(async () => []),
			listFolderEntries: vi.fn(async () => []),
			readFile: vi.fn(async () => new Uint8Array()),
			writeFile: vi.fn(async () => ({})),
		};

		const resultPromise = pollRemoteChanges(remoteFileSystem, createState(), {});
		await vi.advanceTimersByTimeAsync(750);
		const result = await resultPromise;

		expect(listEntries).toHaveBeenCalledTimes(1);
		expect(setLatestEventCursor).toHaveBeenLastCalledWith("volume-1", "event-200");
		expect(result.remoteEventCursor).toBeUndefined();
		expect(result.snapshot).toEqual([
			expect.objectContaining({
				relPath: "full-refresh.md",
				remoteId: "file-2",
				remoteRev: "rev-2",
			}),
		]);
	});

	test("plans a local move when a tracked remote entry is renamed", async () => {
		const result = await pollRemoteChanges(
			{
				listEntries: async () => [
					{
						id: "file-1",
						name: "renamed.md",
						path: "notes/renamed.md",
						type: "file" as const,
						parentId: "root",
						revisionId: "rev-2",
					},
				],
				listFileEntries: async () => [],
				listFolderEntries: async () => [],
				getEntry: async () => null,
				readFile: async () => new Uint8Array(),
				writeFile: async () => ({}),
			},
			createState([
				createEntry({
					relPath: "notes/original.md",
					remoteId: "file-1",
					remoteRev: "rev-1",
				}),
			]),
			{},
		);

		expect(result.removedPaths).toEqual(["notes/original.md"]);
		expect(result.jobs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					op: "move-local",
					fromPath: "notes/original.md",
					toPath: "notes/renamed.md",
					remoteId: "file-1",
				}),
				expect.objectContaining({
					op: "download",
					path: "notes/renamed.md",
					remoteId: "file-1",
				}),
			]),
		);
		expect(result.snapshot).toEqual([
			expect.objectContaining({
				relPath: "notes/renamed.md",
				remoteId: "file-1",
				remoteRev: "rev-2",
			}),
		]);
	});
});
