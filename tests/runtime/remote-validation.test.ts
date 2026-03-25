import { validateRemoteOperations } from "@runtime/use-cases/remote-validation";
import { afterEach, describe, expect, test, vi } from "vitest";

type MemoryEntry = {
	id: string;
	name: string;
	path: string;
	type: "file" | "folder";
	revisionId?: string;
};

function createMemoryRemoteFileSystem() {
	const entries = new Map<string, MemoryEntry>();
	const contentById = new Map<string, Uint8Array>();
	let nextId = 1;
	let nextRevision = 1;

	const listEntries = async () => Array.from(entries.values()).map((entry) => ({ ...entry }));

	return {
		listEntries,
		listFileEntries: async () =>
			(
				Array.from(entries.values()).filter(
					(entry) => entry.type === "file",
				) as Array<MemoryEntry>
			).map((entry) => ({ ...entry })),
		listFolderEntries: async () =>
			(
				Array.from(entries.values()).filter(
					(entry) => entry.type === "folder",
				) as Array<MemoryEntry>
			).map((entry) => ({ ...entry })),
		getEntry: async (id: string) => {
			const entry = entries.get(id);
			return entry ? { ...entry } : null;
		},
		readFile: async (id: string) => contentById.get(id) ?? new Uint8Array(),
		writeFile: async (path: string, data: Uint8Array) => {
			const existing = Array.from(entries.values()).find((entry) => entry.path === path);
			const id = existing?.id ?? `entry-${nextId++}`;
			const revisionId = `rev-${nextRevision++}`;
			entries.set(id, {
				id,
				name: path.split("/").pop() ?? path,
				path,
				type: "file",
				revisionId,
			});
			contentById.set(id, data);
			return { id, revisionId };
		},
		deleteEntry: async (id: string) => {
			entries.delete(id);
			contentById.delete(id);
		},
		moveEntry: async (id: string, newPath: string) => {
			const entry = entries.get(id);
			if (!entry) {
				return;
			}
			entries.set(id, {
				...entry,
				name: newPath.split("/").pop() ?? newPath,
				path: newPath,
			});
		},
		ensureFolder: async (path: string) => {
			const existing = Array.from(entries.values()).find(
				(entry) => entry.type === "folder" && entry.path === path,
			);
			if (existing) {
				return { id: existing.id };
			}
			const id = `entry-${nextId++}`;
			entries.set(id, {
				id,
				name: path.split("/").pop() ?? path,
				path,
				type: "folder",
			});
			return { id };
		},
	};
}

describe("validateRemoteOperations", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("reports a successful end-to-end remote validation workflow", async () => {
		vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
		const remoteFileSystem = createMemoryRemoteFileSystem();

		const report = await validateRemoteOperations(remoteFileSystem as never, "probe");

		expect(report.ok).toBe(true);
		expect(report.rootFolderId).toBeTruthy();
		expect(report.steps.map((step) => step.name)).toEqual([
			"list entries",
			"ensure folder",
			"write file",
			"list uploaded file",
			"read file",
			"write new revision",
			"move/rename file",
			"delete file",
			"cleanup folder",
		]);
		expect(report.steps.every((step) => step.ok)).toBe(true);
	});

	test("fails early when folder creation is unsupported", async () => {
		const report = await validateRemoteOperations(
			{
				listEntries: async () => [],
				listFileEntries: async () => [],
				listFolderEntries: async () => [],
				getEntry: async () => null,
				readFile: async () => new Uint8Array(),
				writeFile: async () => ({ id: "file-1" }),
			} as never,
			"probe",
		);

		expect(report.ok).toBe(false);
		expect(report.steps).toEqual([
			expect.objectContaining({
				name: "list entries",
				ok: true,
			}),
			expect.objectContaining({
				name: "ensure folder",
				ok: false,
				detail: "Remote provider does not support folder creation.",
			}),
		]);
	});
});
