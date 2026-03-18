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

	test("treats status-based 404 delete errors as idempotent success", async () => {
		const fileSystem = new ProtonDriveRemoteFileSystem(
			{
				trashNodes: async function* () {
					yield {
						ok: false,
						uid: "file-a",
						error: {
							status: 404,
						},
					};
				},
			},
			"root",
		);

		await expect(fileSystem.deleteEntry?.("file-a")).resolves.toBeUndefined();
	});

	test("maps status-based 429 remote errors without relying on message text", async () => {
		const fileSystem = new ProtonDriveRemoteFileSystem(
			{
				getFileUploader: async () => {
					throw new Error("should not upload");
				},
				getFileRevisionUploader: async () => {
					throw {
						status: 429,
					};
				},
				iterateFolderChildren: async function* () {
					yield {
						ok: true,
						value: {
							uid: "file-a",
							parentUid: "root",
							name: "a.md",
							type: "file",
						},
					};
				},
			},
			"root",
		);

		let caught: unknown;
		try {
			await fileSystem.writeFile("a.md", new Uint8Array([1, 2, 3]));
		} catch (error) {
			caught = error;
		}

		expect(isDriveSyncError(caught)).toBe(true);
		expect(caught).toMatchObject({
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
		});
	});

	test("lists only root-level folders for child folder listing", async () => {
		const fileSystem = new ProtonDriveRemoteFileSystem(
			{
				iterateFolderChildren: async function* (parentNodeUid: string) {
					if (parentNodeUid === "root") {
						yield {
							ok: true,
							value: {
								uid: "folder-a",
								parentUid: "root",
								name: "Projects",
								type: "folder",
							},
						};
						yield {
							ok: true,
							value: {
								uid: "file-a",
								parentUid: "root",
								name: "note.md",
								type: "file",
							},
						};
						return;
					}

					yield {
						ok: true,
						value: {
							uid: "folder-b",
							parentUid: "folder-a",
							name: "Nested",
							type: "folder",
						},
					};
				},
			},
			"root",
		);

		const entries = await fileSystem.listChildFolderEntries();

		expect(entries).toEqual([
			expect.objectContaining({
				id: "folder-a",
				path: "Projects",
				type: "folder",
			}),
		]);
	});

	test("resolves nested paths from parent chain when entry cache is cold", async () => {
		const fileSystem = new ProtonDriveRemoteFileSystem(
			{
				getNode: async (nodeUid: string) => {
					if (nodeUid === "file-a") {
						return {
							ok: true,
							value: {
								uid: "file-a",
								parentUid: "folder-a",
								name: "note.md",
								type: "file",
							},
						};
					}
					if (nodeUid === "folder-a") {
						return {
							ok: true,
							value: {
								uid: "folder-a",
								parentUid: "root",
								name: "docs",
								type: "folder",
							},
						};
					}
					throw new Error(`unexpected node: ${nodeUid}`);
				},
			},
			"root",
		);

		const entry = await fileSystem.getEntry("file-a");

		expect(entry).toEqual(
			expect.objectContaining({
				id: "file-a",
				path: "docs/note.md",
			}),
		);
	});

	test("uses the selected scope root for event subscription bootstrap", async () => {
		const getNode = async (nodeUid: string) => {
			if (nodeUid !== "folder-a") {
				throw new Error(`unexpected node: ${nodeUid}`);
			}
			return {
				ok: true,
				value: {
					uid: "folder-a",
					parentUid: "root",
					name: "Scoped",
					type: "folder",
					treeEventScopeId: "scope-1",
				},
			};
		};
		const fileSystem = new ProtonDriveRemoteFileSystem(
			{
				getNode,
				getMyFilesRootFolder: async () => {
					throw new Error("should not use my-files root for scoped polling");
				},
			},
			"folder-a",
		);

		const rootEntry = await fileSystem.getRootEntry();

		expect(rootEntry).toEqual(
			expect.objectContaining({
				id: "folder-a",
				path: "",
				eventScopeId: "scope-1",
			}),
		);
	});

	test("does not treat transient getNode failures as missing entries", async () => {
		const fileSystem = new ProtonDriveRemoteFileSystem(
			{
				getNode: async () => ({
					ok: false,
					error: { status: 429 },
				}),
			},
			"root",
		);

		await expect(fileSystem.getEntry("file-a")).rejects.toMatchObject({
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
		});
	});
});
