import { executeJobs } from "@sync/engine/executor";
import { createJob, textBytes } from "@tests/helpers/sync-fixtures";
import { describe, expect, test } from "vitest";

describe("executeJobs", () => {
	test("uploads files and records sync metadata", async () => {
		const localFileSystem = {
			listEntries: async () => [],
			listFileEntries: async () => [],
			listFolderEntries: async () => [],
			getEntry: async () => ({
				path: "notes/a.md",
				type: "file" as const,
				size: 3,
				mtimeMs: 123,
			}),
			readFile: async () => textBytes("abc"),
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
			writeFile: async () => ({
				id: "remote-1",
				revisionId: "rev-1",
			}),
		};

		const result = await executeJobs(localFileSystem, remoteFileSystem, [createJob()]);

		expect(result.jobsExecuted).toBe(1);
		expect(result.uploadBytes).toBe(3);
		expect(result.downloadBytes).toBe(0);
		expect(result.entries).toEqual([
			expect.objectContaining({
				relPath: "notes/a.md",
				remoteId: "remote-1",
				remoteRev: "rev-1",
				syncedRemoteRev: "rev-1",
				localSize: 3,
				localMtimeMs: 123,
				tombstone: false,
			}),
		]);
		expect(result.entries[0]?.localHash).toBe(result.entries[0]?.syncedLocalHash);
	});

	test("throws REMOTE_UNSUPPORTED when move-remote is not implemented", async () => {
		const localFileSystem = {
			listEntries: async () => [],
			listFileEntries: async () => [],
			listFolderEntries: async () => [],
			getEntry: async () => null,
			readFile: async () => new Uint8Array(),
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
			writeFile: async () => ({ id: "remote-1" }),
		};

		await expect(
			executeJobs(localFileSystem, remoteFileSystem, [
				createJob({
					id: "job-move-remote",
					op: "move-remote",
					path: "notes/b.md",
					toPath: "notes/c.md",
					remoteId: "remote-1",
				}),
			]),
		).rejects.toMatchObject({
			code: "REMOTE_UNSUPPORTED",
			category: "provider",
		});
	});
});
