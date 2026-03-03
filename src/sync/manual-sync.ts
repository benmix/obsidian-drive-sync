import { getBuiltInExcludeRules, isExcluded } from "./exclude";
import type { LocalFileSystem, RemoteFileSystem } from "./types";

export async function syncLocalToRemote(
	localFs: LocalFileSystem,
	remoteFs: RemoteFileSystem,
): Promise<{ uploaded: number }> {
	const files = await localFs.listFiles();
	let uploaded = 0;
	const rules = getBuiltInExcludeRules();

	for (const file of files) {
		if (file.type !== "file") {
			continue;
		}
		if (isExcluded(file.path, rules)) {
			continue;
		}
		const data = await localFs.readFile(file.path);
		await remoteFs.uploadFile(file.path, data, {
			mtimeMs: file.mtimeMs,
			size: file.size,
		});
		uploaded += 1;
	}

	return { uploaded };
}

export async function syncRemoteToLocal(
	localFs: LocalFileSystem,
	remoteFs: RemoteFileSystem,
): Promise<{ downloaded: number }> {
	const remoteFiles = await remoteFs.listFiles();
	let downloaded = 0;
	const rules = getBuiltInExcludeRules();

	for (const remoteFile of remoteFiles) {
		if (remoteFile.type !== "file") {
			continue;
		}
		const data = await remoteFs.downloadFile(remoteFile.id);
		const path = remoteFile.path ?? remoteFile.name;
		if (isExcluded(path, rules)) {
			continue;
		}
		await localFs.writeFile(path, data);
		downloaded += 1;
	}

	return { downloaded };
}
