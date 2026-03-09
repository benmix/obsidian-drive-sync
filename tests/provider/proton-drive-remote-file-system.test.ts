import { describe, expect, test } from "vitest";

import { isDriveSyncError } from "../../src/errors";
import { ProtonDriveRemoteFileSystem } from "../../src/provider/providers/proton-drive/remote-file-system";

describe("ProtonDriveRemoteFileSystem", () => {
	test("prefers claimed revision modification time for file entries", async () => {
		const claimedModificationTime = new Date("2026-03-09T10:00:00.000Z");
		const nodeModificationTime = new Date("2026-03-09T10:05:00.000Z");
		const fileSystem = new ProtonDriveRemoteFileSystem(
			{
				iterateFolderChildren: async function* () {
					yield {
						ok: true,
						value: {
							uid: "file-a",
							name: "a.md",
							type: "file",
							modificationTime: nodeModificationTime,
							activeRevision: {
								uid: "rev-a",
								claimedModificationTime,
								storageSize: 42,
							},
						},
					};
				},
			},
			"root",
		);

		const entries = await fileSystem.listEntries();

		expect(entries).toEqual([
			expect.objectContaining({
				id: "file-a",
				path: "a.md",
				mtimeMs: claimedModificationTime.getTime(),
				size: 42,
				revisionId: "rev-a",
			}),
		]);
	});

	test("maps folder-path conflicts to DriveSyncError", async () => {
		const fileSystem = new ProtonDriveRemoteFileSystem(
			{
				getFileUploader: async () => {
					throw new Error("should not upload");
				},
				getFileRevisionUploader: async () => {
					throw new Error("should not revise");
				},
				iterateFolderChildren: async function* (parentNodeUid: string) {
					if (parentNodeUid !== "root") {
						return;
					}
					yield {
						ok: true,
						value: {
							uid: "folder-a",
							parentUid: "root",
							name: "notes",
							type: "folder",
						},
					};
				},
			},
			"root",
		);

		let caught: unknown;
		try {
			await fileSystem.writeFile("notes", new Uint8Array([1, 2, 3]));
		} catch (error) {
			caught = error;
		}

		expect(isDriveSyncError(caught)).toBe(true);
		expect(caught).toMatchObject({
			code: "REMOTE_PATH_CONFLICT",
			category: "remote_fs",
		});
	});

	test("maps unsupported SDK capabilities to DriveSyncError", async () => {
		const fileSystem = new ProtonDriveRemoteFileSystem({}, "root");

		let caught: unknown;
		try {
			await fileSystem.readFile("file-a");
		} catch (error) {
			caught = error;
		}

		expect(isDriveSyncError(caught)).toBe(true);
		expect(caught).toMatchObject({
			code: "REMOTE_UNSUPPORTED",
			category: "provider",
		});
	});
});
