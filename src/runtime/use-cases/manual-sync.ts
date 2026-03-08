import { getBuiltInExcludeRules, isExcluded } from "../../sync/planner/exclude";
import type { LocalFileSystem, RemoteFileSystem } from "../../contracts/filesystem/file-system";

export async function syncLocalToRemote(
	localFileSystem: LocalFileSystem,
	remoteFileSystem: RemoteFileSystem,
): Promise<{ uploaded: number }> {
	const files = await localFileSystem.listFileEntries();
	let uploaded = 0;
	const rules = getBuiltInExcludeRules();

	for (const file of files) {
		if (file.type !== "file") {
			continue;
		}
		if (isExcluded(file.path, rules)) {
			continue;
		}
		const data = await localFileSystem.readFile(file.path);
		await remoteFileSystem.writeFile(file.path, data, {
			mtimeMs: file.mtimeMs,
			size: file.size,
		});
		uploaded += 1;
	}

	return { uploaded };
}

export async function syncRemoteToLocal(
	localFileSystem: LocalFileSystem,
	remoteFileSystem: RemoteFileSystem,
): Promise<{ downloaded: number }> {
	const remoteFiles = await remoteFileSystem.listFileEntries();
	let downloaded = 0;
	const rules = getBuiltInExcludeRules();

	for (const remoteFile of remoteFiles) {
		if (remoteFile.type !== "file") {
			continue;
		}
		const data = await remoteFileSystem.readFile(remoteFile.id);
		const path = remoteFile.path ?? remoteFile.name;
		if (isExcluded(path, rules)) {
			continue;
		}
		await localFileSystem.writeFile(path, data);
		downloaded += 1;
	}

	return { downloaded };
}
