import type { ProtonDriveClient } from "@protontech/drive-sdk";
import { ProtonDriveRemoteFs } from "../sync/remote-fs";

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
	client: ProtonDriveClient,
	remoteFolderId: string,
): Promise<RemoteValidationReport> {
	const steps: ValidationStep[] = [];
	const remoteFs = new ProtonDriveRemoteFs(client, remoteFolderId);
	const encoder = new TextEncoder();
	const suffix = Date.now().toString(36);
	const rootPath = `__protondrive_sync_validation_${suffix}`;
	const sourcePath = `${rootPath}/source`;
	const destPath = `${rootPath}/dest`;
	const filePath = `${sourcePath}/sample.txt`;
	const movedPath = `${destPath}/sample-renamed.txt`;

	let rootFolderId: string | undefined;
	let fileId: string | undefined;
	let fileRevisionId: string | undefined;

	try {
		try {
			const entries = await remoteFs.listEntries();
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

		try {
			const created = await remoteFs.createFolder(sourcePath);
			await remoteFs.createFolder(destPath);
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
			const upload = await remoteFs.uploadFile(filePath, payload, {
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
			const entries = await remoteFs.listEntries();
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
			const downloaded = await remoteFs.downloadFile(fileId);
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
			const upload = await remoteFs.uploadFile(filePath, payload, {
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

		try {
			if (!fileId) {
				throw new Error("missing file id");
			}
			await remoteFs.movePath(fileId, movedPath);
			const entries = await remoteFs.listEntries();
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

		try {
			if (!fileId) {
				throw new Error("missing file id");
			}
			await remoteFs.deletePath(fileId);
			const entries = await remoteFs.listEntries();
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
	} finally {
		if (rootFolderId) {
			try {
				await remoteFs.deletePath(rootFolderId);
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
