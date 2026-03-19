import { pollRemoteChanges } from "@sync/planner/remote-poller";
import { createState } from "@tests/helpers/sync-fixtures";
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
});
