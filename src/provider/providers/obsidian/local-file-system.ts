import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";

import type { LocalFileEntry, LocalFileSystem } from "../../../contracts/filesystem/file-system";

export class ObsidianLocalFileSystem implements LocalFileSystem {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async listEntries(): Promise<LocalFileEntry[]> {
		const entries: LocalFileEntry[] = [];
		const stack: TAbstractFile[] = [...this.app.vault.getRoot().children];
		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) {
				continue;
			}
			if (current instanceof TFile) {
				entries.push(this.mapFile(current));
				continue;
			}
			if (current instanceof TFolder) {
				if (current.path) {
					entries.push(this.mapFolder(current));
				}
				stack.push(...current.children);
			}
		}
		return entries;
	}

	async listFileEntries(): Promise<LocalFileEntry[]> {
		return this.app.vault.getFiles().map((file) => this.mapFile(file));
	}

	async listFolderEntries(): Promise<LocalFileEntry[]> {
		return (await this.listEntries()).filter((entry) => entry.type === "folder");
	}

	async getEntry(path: string): Promise<LocalFileEntry | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file) {
			return null;
		}
		if (file instanceof TFile) {
			return this.mapFile(file);
		}
		if (file instanceof TFolder) {
			return this.mapFolder(file);
		}
		return null;
	}

	async readFile(path: string): Promise<Uint8Array> {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			throw new Error(`Unable to read missing file: ${path}`);
		}
		const tfile = file as TFile;
		const data = await this.app.vault.readBinary(tfile);
		return new Uint8Array(data);
	}

	async writeFile(path: string, data: Uint8Array): Promise<void> {
		await this.ensureParentFolder(path);
		await this.app.vault.adapter.writeBinary(path, new Uint8Array(data).buffer);
	}

	async deleteEntry(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file) {
			return;
		}
		await this.app.vault.delete(file, true);
	}

	async moveEntry(fromPath: string, toPath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(fromPath);
		if (!file) {
			throw new Error(`Unable to move missing path: ${fromPath}`);
		}
		await this.ensureParentFolder(toPath);
		await this.app.vault.rename(file, toPath);
	}

	async ensureFolder(path: string): Promise<void> {
		if (!path) {
			return;
		}
		const exists = await this.app.vault.adapter.exists(path);
		if (!exists) {
			await this.app.vault.adapter.mkdir(path);
		}
	}

	private mapFile(file: TFile): LocalFileEntry {
		return {
			path: file.path,
			type: "file",
			mtimeMs: file.stat.mtime,
			size: file.stat.size,
		};
	}

	private mapFolder(folder: TFolder): LocalFileEntry {
		return {
			path: folder.path,
			type: "folder",
		};
	}

	private async ensureParentFolder(path: string) {
		const parentPath = path.split("/").slice(0, -1).join("/");
		if (!parentPath) {
			return;
		}
		const exists = await this.app.vault.adapter.exists(parentPath);
		if (!exists) {
			await this.app.vault.adapter.mkdir(parentPath);
		}
	}
}
