import { filterLocalChanges } from "@sync/planner/local-change-filter";
import { hashBytes } from "@sync/support/hash";
import {
	createEntry,
	createLocalFileSystem,
	createState,
	textBytes,
} from "@tests/helpers/sync-fixtures";
import { describe, expect, test } from "vitest";

describe("filterLocalChanges", () => {
	test("drops unchanged file modify event when metadata matches tracked state", async () => {
		const state = createState([
			createEntry({
				relPath: "notes/a.md",
				type: "file",
				localMtimeMs: 1_000,
				localSize: 5,
			}),
		]);
		const localFileSystem = createLocalFileSystem([
			{ path: "notes/a.md", type: "file", mtimeMs: 1_000, size: 5 },
		]);

		const changes = await filterLocalChanges(
			[{ type: "modify", path: "notes/a.md", entryType: "file" }],
			state,
			localFileSystem,
		);

		expect(changes).toEqual([]);
	});

	test("keeps file modify event when hash differs despite identical metadata", async () => {
		const priorBytes = textBytes("prior");
		const nextBytes = textBytes("next!");
		const state = createState([
			createEntry({
				relPath: "notes/a.md",
				type: "file",
				localMtimeMs: 1_000,
				localSize: nextBytes.byteLength,
				syncedLocalHash: await hashBytes(priorBytes),
			}),
		]);
		const localFileSystem = createLocalFileSystem(
			[{ path: "notes/a.md", type: "file", mtimeMs: 1_000, size: nextBytes.byteLength }],
			{ "notes/a.md": nextBytes },
		);

		const changes = await filterLocalChanges(
			[{ type: "modify", path: "notes/a.md", entryType: "file" }],
			state,
			localFileSystem,
		);

		expect(changes).toEqual([{ type: "modify", path: "notes/a.md", entryType: "file" }]);
	});

	test("drops folder modify noise", async () => {
		const state = createState([
			createEntry({
				relPath: "notes",
				type: "folder",
			}),
		]);
		const localFileSystem = createLocalFileSystem([{ path: "notes", type: "folder" }]);

		const changes = await filterLocalChanges(
			[{ type: "modify", path: "notes", entryType: "folder" }],
			state,
			localFileSystem,
		);

		expect(changes).toEqual([]);
	});
});
