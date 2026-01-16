import type { App, TFile } from "obsidian";
import type { LocalFileEntry, LocalFileSystem } from "./types";

export class ObsidianLocalFs implements LocalFileSystem {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async listFiles(): Promise<LocalFileEntry[]> {
		return this.app.vault.getFiles().map((file) => this.mapFile(file));
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
		await this.app.vault.adapter.writeBinary(path, data);
	}

	async deletePath(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file) {
			return;
		}
		await this.app.vault.delete(file, true);
	}

	async movePath(fromPath: string, toPath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(fromPath);
		if (!file) {
			throw new Error(`Unable to move missing path: ${fromPath}`);
		}
		await this.ensureParentFolder(toPath);
		await this.app.vault.rename(file, toPath);
	}

	private mapFile(file: TFile): LocalFileEntry {
		return {
			path: file.path,
			mtimeMs: file.stat.mtime,
			size: file.stat.size,
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
