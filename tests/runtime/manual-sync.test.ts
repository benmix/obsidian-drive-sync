import { syncLocalToRemote, syncRemoteToLocal } from "@runtime/use-cases/manual-sync";
import { textBytes } from "@tests/helpers/sync-fixtures";
import { describe, expect, test, vi } from "vitest";

describe("manual sync workflows", () => {
	test("syncLocalToRemote uploads only non-excluded files and preserves metadata", async () => {
		const readFile = vi.fn(async (path: string) => textBytes(`local:${path}`));
		const writeFile = vi.fn(async () => ({
			id: "remote-uploaded",
			revisionId: "rev-1",
		}));
		const localFileSystem = {
			listEntries: async () => [],
			listFileEntries: async () => [
				{
					path: "notes/a.md",
					type: "file" as const,
					size: 3,
					mtimeMs: 123,
				},
				{
					path: ".obsidian/workspace.json",
					type: "file" as const,
					size: 20,
					mtimeMs: 456,
				},
			],
			listFolderEntries: async () => [],
			getEntry: async () => null,
			readFile,
			writeFile: async () => {},
			deleteEntry: async () => {},
			moveEntry: async () => {},
			ensureFolder: async () => {},
		};
		const remoteFileSystem = {
			listEntries: async () => [],
			listFileEntries: async () => [],
			listFolderEntries: async () => [],
			getEntry: async () => null,
			readFile: async () => new Uint8Array(),
			writeFile,
		};

		await expect(syncLocalToRemote(localFileSystem, remoteFileSystem)).resolves.toEqual({
			uploaded: 1,
		});
		expect(readFile).toHaveBeenCalledTimes(1);
		expect(readFile).toHaveBeenCalledWith("notes/a.md");
		expect(writeFile).toHaveBeenCalledWith("notes/a.md", textBytes("local:notes/a.md"), {
			mtimeMs: 123,
			size: 3,
		});
	});

	test("syncRemoteToLocal downloads non-excluded files and falls back to entry name", async () => {
		const readFile = vi.fn(async (id: string) => textBytes(`remote:${id}`));
		const writeFile = vi.fn(async () => {});
		const localFileSystem = {
			listEntries: async () => [],
			listFileEntries: async () => [],
			listFolderEntries: async () => [],
			getEntry: async () => null,
			readFile: async () => new Uint8Array(),
			writeFile,
			deleteEntry: async () => {},
			moveEntry: async () => {},
			ensureFolder: async () => {},
		};
		const remoteFileSystem = {
			listEntries: async () => [],
			listFileEntries: async () => [
				{
					id: "remote-1",
					name: "note.md",
					type: "file" as const,
				},
				{
					id: "remote-2",
					name: "workspace.json",
					path: ".obsidian/workspace.json",
					type: "file" as const,
				},
			],
			listFolderEntries: async () => [],
			getEntry: async () => null,
			readFile,
			writeFile: async () => ({
				id: "remote-uploaded",
			}),
		};

		await expect(syncRemoteToLocal(localFileSystem, remoteFileSystem)).resolves.toEqual({
			downloaded: 1,
		});
		expect(writeFile).toHaveBeenCalledTimes(1);
		expect(writeFile).toHaveBeenCalledWith("note.md", textBytes("remote:remote-1"));
	});
});
