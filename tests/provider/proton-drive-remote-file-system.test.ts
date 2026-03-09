import { describe, expect, test } from "vitest";

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
});
