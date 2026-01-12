import type {App, TFile} from "obsidian";

type ProtonDriveClient = {
	files?: {
		uploadFile?: (options: {
			parentId: string;
			name: string;
			data: Uint8Array;
			path?: string;
		}) => Promise<void>;
		listFolder?: (options: {parentId: string}) => Promise<Array<{id: string; name: string}>>;
		downloadFile?: (options: {id: string}) => Promise<Uint8Array>;
	};
};

export async function syncVaultToProtonDrive(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string
): Promise<{uploaded: number}> {
	if (!client.files?.uploadFile) {
		throw new Error("Proton Drive SDK does not expose files.uploadFile.");
	}

	const files = app.vault.getFiles();
	let uploaded = 0;

	for (const file of files) {
		const data = await readFileData(app, file);
		await client.files.uploadFile({
			parentId: remoteFolderId,
			name: file.path,
			data,
			path: file.path
		});
		uploaded += 1;
	}

	return {uploaded};
}

export async function restoreVaultFromProtonDrive(
	app: App,
	client: ProtonDriveClient,
	remoteFolderId: string
): Promise<{downloaded: number}> {
	if (!client.files?.listFolder || !client.files?.downloadFile) {
		throw new Error("Proton Drive SDK does not expose files.listFolder or files.downloadFile.");
	}

	const remoteFiles = await client.files.listFolder({parentId: remoteFolderId});
	let downloaded = 0;

	for (const remoteFile of remoteFiles) {
		const data = await client.files.downloadFile({id: remoteFile.id});
		const targetPath = remoteFile.name;
		await ensureParentFolder(app, targetPath);
		await app.vault.adapter.writeBinary(targetPath, data);
		downloaded += 1;
	}

	return {downloaded};
}

async function readFileData(app: App, file: TFile): Promise<Uint8Array> {
	const arrayBuffer = await app.vault.readBinary(file);
	return new Uint8Array(arrayBuffer);
}

async function ensureParentFolder(app: App, filePath: string) {
	const parentPath = filePath.split("/").slice(0, -1).join("/");
	if (!parentPath) {
		return;
	}
	const exists = await app.vault.adapter.exists(parentPath);
	if (!exists) {
		await app.vault.adapter.mkdir(parentPath);
	}
}
