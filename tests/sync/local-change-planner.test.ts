import { afterEach, describe, expect, test, vi } from "vitest";
import { createEntry, createState, FIXED_NOW } from "../helpers/sync-fixtures";
import { planLocalChanges } from "../../src/sync/planner/local-change-planner";

describe("planLocalChanges", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("plans remote move when renaming a tracked file", () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState([
			createEntry({
				relPath: "notes/a.md",
				type: "file",
				remoteId: "remote-a",
				remoteParentId: "parent-a",
			}),
		]);

		const plan = planLocalChanges(
			[
				{
					type: "rename",
					from: "notes/a.md",
					to: "notes/b.md",
					entryType: "file",
				},
			],
			state,
		);

		expect(plan.jobs).toHaveLength(1);
		expect(plan.jobs[0]).toMatchObject({
			op: "move-remote",
			path: "notes/a.md",
			fromPath: "notes/a.md",
			toPath: "notes/b.md",
			remoteId: "remote-a",
			reason: "rename",
			nextRunAt: FIXED_NOW,
		});
		expect(plan.entries).toEqual([
			expect.objectContaining({
				relPath: "notes/b.md",
				type: "file",
				remoteId: "remote-a",
			}),
		]);
		expect(plan.removedPaths).toEqual(["notes/a.md"]);
		expect(plan.rewritePrefixes).toEqual([]);
	});

	test("plans folder rename without prior remote mapping as create + prefix rewrite", () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const plan = planLocalChanges(
			[
				{
					type: "rename",
					from: "old-folder",
					to: "new-folder",
					entryType: "folder",
				},
			],
			createState(),
		);

		expect(plan.jobs).toEqual([
			expect.objectContaining({
				op: "create-remote-folder",
				path: "new-folder",
				reason: "rename-folder",
			}),
		]);
		expect(plan.removedPaths).toEqual(["old-folder"]);
		expect(plan.rewritePrefixes).toEqual([{ from: "old-folder", to: "new-folder" }]);
	});

	test("plans tracked delete as delete-remote and tombstone", () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState([
			createEntry({
				relPath: "notes/a.md",
				type: "file",
				remoteId: "remote-a",
			}),
		]);

		const plan = planLocalChanges(
			[{ type: "delete", path: "notes/a.md", entryType: "file" }],
			state,
		);

		expect(plan.jobs).toEqual([
			expect.objectContaining({
				op: "delete-remote",
				path: "notes/a.md",
				remoteId: "remote-a",
				reason: "delete",
			}),
		]);
		expect(plan.entries).toContainEqual(
			expect.objectContaining({
				relPath: "notes",
				type: "folder",
			}),
		);
		expect(plan.entries).toContainEqual(
			expect.objectContaining({
				relPath: "notes/a.md",
				tombstone: true,
			}),
		);
	});

	test("ensures parent folder exists before uploading a new file", () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const plan = planLocalChanges(
			[{ type: "create", path: "drafts/new.md", entryType: "file" }],
			createState(),
		);

		expect(plan.jobs.map((job) => [job.op, job.path, job.reason])).toEqual([
			["create-remote-folder", "drafts", "ensure-parent"],
			["upload", "drafts/new.md", "create"],
		]);
	});

	test("skips ensure-parent when parent folder is already tracked", () => {
		vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
		const state = createState([
			createEntry({
				relPath: "drafts",
				type: "folder",
				remoteId: "remote-drafts",
			}),
		]);

		const plan = planLocalChanges(
			[{ type: "modify", path: "drafts/new.md", entryType: "file" }],
			state,
		);

		expect(plan.jobs).toHaveLength(1);
		expect(plan.jobs[0]).toMatchObject({
			op: "upload",
			path: "drafts/new.md",
			reason: "modify",
		});
	});
});
