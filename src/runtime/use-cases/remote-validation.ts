import type { RemoteFileSystem } from "../../filesystem";

export type ValidationStep = {
	name: string;
	ok: boolean;
	detail?: string;
};

export type RemoteValidationReport = {
	ok: boolean;
	rootFolderId?: string;
	steps: ValidationStep[];
};

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) {
		return false;
	}
	for (let i = 0; i < a.byteLength; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

export async function validateRemoteOperations(
	remoteFileSystem: RemoteFileSystem,
	prefix = "__remote_sync_validation",
): Promise<RemoteValidationReport> {
	const steps: ValidationStep[] = [];
	const encoder = new TextEncoder();
	const suffix = Date.now().toString(36);
	const rootPath = `${prefix}_${suffix}`;
	const sourcePath = `${rootPath}/source`;
	const destPath = `${rootPath}/dest`;
	const filePath = `${sourcePath}/sample.txt`;
	const movedPath = `${destPath}/sample-renamed.txt`;

	let rootFolderId: string | undefined;
	let fileId: string | undefined;
	let fileRevisionId: string | undefined;

	try {
		try {
			const entries = await remoteFileSystem.listEntries();
			steps.push({
				name: "list entries",
				ok: true,
				detail: `count=${entries.length}`,
			});
		} catch (error) {
			steps.push({
				name: "list entries",
				ok: false,
				detail: error instanceof Error ? error.message : "unknown error",
			});
		}

		if (!remoteFileSystem.createFolder) {
			steps.push({
				name: "create folder",
				ok: false,
				detail: "Remote provider does not support folder creation.",
			});
			return { ok: false, rootFolderId, steps };
		}

		try {
			const created = await remoteFileSystem.createFolder(sourcePath);
			await remoteFileSystem.createFolder(destPath);
			rootFolderId = created.id;
			steps.push({
				name: "create folder",
				ok: Boolean(rootFolderId),
				detail: rootFolderId ? `id=${rootFolderId}` : "no id returned",
			});
		} catch (error) {
			steps.push({
				name: "create folder",
				ok: false,
				detail: error instanceof Error ? error.message : "unknown error",
			});
			return { ok: false, rootFolderId, steps };
		}

		try {
			const payload = encoder.encode(`validation-${suffix}-v1`);
			const upload = await remoteFileSystem.uploadFile(filePath, payload, {
				mtimeMs: Date.now(),
				size: payload.byteLength,
			});
			fileId = upload.id;
			fileRevisionId = upload.revisionId;
			steps.push({
				name: "upload file",
				ok: Boolean(fileId),
				detail: fileId ? `id=${fileId}` : "no id returned",
			});
		} catch (error) {
			steps.push({
				name: "upload file",
				ok: false,
				detail: error instanceof Error ? error.message : "unknown error",
			});
			return { ok: false, rootFolderId, steps };
		}

		try {
			const entries = await remoteFileSystem.listEntries();
			const match = entries.find((entry) => entry.path === filePath);
			const ok = Boolean(match?.id && match.id === fileId);
			steps.push({
				name: "list uploaded file",
				ok,
				detail: match?.id ? `id=${match.id}` : "missing entry",
			});
		} catch (error) {
			steps.push({
				name: "list uploaded file",
				ok: false,
				detail: error instanceof Error ? error.message : "unknown error",
			});
		}

		try {
			if (!fileId) {
				throw new Error("missing file id");
			}
			const downloaded = await remoteFileSystem.downloadFile(fileId);
			const expected = encoder.encode(`validation-${suffix}-v1`);
			const ok = sameBytes(downloaded, expected);
			steps.push({
				name: "download file",
				ok,
				detail: ok ? "content matches" : "content mismatch",
			});
		} catch (error) {
			steps.push({
				name: "download file",
				ok: false,
				detail: error instanceof Error ? error.message : "unknown error",
			});
		}

		try {
			const payload = encoder.encode(`validation-${suffix}-v2`);
			const upload = await remoteFileSystem.uploadFile(filePath, payload, {
				mtimeMs: Date.now(),
				size: payload.byteLength,
			});
			const ok = Boolean(fileId && upload.id === fileId);
			const revisionChanged =
				fileRevisionId && upload.revisionId
					? upload.revisionId !== fileRevisionId
					: undefined;
			steps.push({
				name: "upload new revision",
				ok,
				detail:
					revisionChanged === undefined
						? `id=${upload.id ?? "missing"}`
						: `id=${upload.id ?? "missing"} revChanged=${revisionChanged}`,
			});
		} catch (error) {
			steps.push({
				name: "upload new revision",
				ok: false,
				detail: error instanceof Error ? error.message : "unknown error",
			});
		}

		if (!remoteFileSystem.movePath) {
			steps.push({
				name: "move/rename file",
				ok: false,
				detail: "Remote provider does not support move operation.",
			});
		} else {
			try {
				if (!fileId) {
					throw new Error("missing file id");
				}
				await remoteFileSystem.movePath(fileId, movedPath);
				const entries = await remoteFileSystem.listEntries();
				const match = entries.find((entry) => entry.path === movedPath);
				const ok = Boolean(match?.id && match.id === fileId);
				steps.push({
					name: "move/rename file",
					ok,
					detail: match?.id ? `id=${match.id}` : "missing entry",
				});
			} catch (error) {
				steps.push({
					name: "move/rename file",
					ok: false,
					detail: error instanceof Error ? error.message : "unknown error",
				});
			}
		}

		if (!remoteFileSystem.deletePath) {
			steps.push({
				name: "delete file",
				ok: false,
				detail: "Remote provider does not support delete operation.",
			});
		} else {
			try {
				if (!fileId) {
					throw new Error("missing file id");
				}
				await remoteFileSystem.deletePath(fileId);
				const entries = await remoteFileSystem.listEntries();
				const match = entries.find((entry) => entry.id === fileId);
				const ok = !match;
				steps.push({
					name: "delete file",
					ok,
					detail: ok ? "deleted" : "still present",
				});
			} catch (error) {
				steps.push({
					name: "delete file",
					ok: false,
					detail: error instanceof Error ? error.message : "unknown error",
				});
			}
		}
	} finally {
		if (rootFolderId && remoteFileSystem.deletePath) {
			try {
				await remoteFileSystem.deletePath(rootFolderId);
				steps.push({
					name: "cleanup folder",
					ok: true,
				});
			} catch (error) {
				steps.push({
					name: "cleanup folder",
					ok: false,
					detail: error instanceof Error ? error.message : "unknown error",
				});
			}
		}
	}

	const ok = steps.every((step) => step.ok);
	return { ok, rootFolderId, steps };
}
