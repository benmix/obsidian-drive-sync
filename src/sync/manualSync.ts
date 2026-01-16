import type {LocalFileSystem, RemoteFileSystem} from "./types";

export async function syncLocalToRemote(
	localFs: LocalFileSystem,
	remoteFs: RemoteFileSystem
): Promise<{uploaded: number}> {
	const files = await localFs.listFiles();
	let uploaded = 0;

	for (const file of files) {
		const data = await localFs.readFile(file.path);
		await remoteFs.uploadFile(file.path, data);
		uploaded += 1;
	}

	return {uploaded};
}

export async function syncRemoteToLocal(
	localFs: LocalFileSystem,
	remoteFs: RemoteFileSystem
): Promise<{downloaded: number}> {
	const remoteFiles = await remoteFs.listFiles();
	let downloaded = 0;

	for (const remoteFile of remoteFiles) {
		const data = await remoteFs.downloadFile(remoteFile.id);
		await localFs.writeFile(remoteFile.name, data);
		downloaded += 1;
	}

	return {downloaded};
}
