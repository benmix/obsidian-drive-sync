import { Modal, Notice, Setting } from "obsidian";
import type { RemoteFileEntry, RemoteFileSystem } from "../contracts/filesystem/file-system";
import type { App } from "obsidian";
import { normalizePath } from "../filesystem/path";
import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";

export class RemoteFolderPickerModal extends Modal {
	private plugin: ObsidianDriveSyncPluginApi;
	private folders: RemoteFileEntry[] = [];
	private createPath = "";
	private selectedFolderId = "";
	private loading = false;
	private refreshing = false;
	private creating = false;
	private error: string | null = null;
	private createError: string | null = null;
	private rootLabel = "Remote root";
	private rootFolderId = "";
	private remoteFileSystem: RemoteFileSystem | null = null;

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		await this.loadFolders();
		this.render();
	}

	private async loadFolders(): Promise<void> {
		this.loading = true;
		this.refreshing = false;
		this.creating = false;
		this.error = null;
		this.createError = null;
		this.folders = [];
		this.rootFolderId = "";
		this.remoteFileSystem = null;
		this.selectedFolderId = this.plugin.getRemoteScopeId().trim();

		const provider = this.plugin.getRemoteProvider();
		if (!this.plugin.getStoredProviderCredentials() && !provider.getSession()) {
			this.error = `Sign in to ${provider.label} first.`;
			this.loading = false;
			return;
		}

		const client = await this.plugin.connectRemoteClient();
		if (!client) {
			this.error = `Unable to connect to ${provider.label}.`;
			this.loading = false;
			return;
		}

		try {
			const rootScope = await provider.getRootScope(client);
			this.rootLabel = rootScope.label || "Remote root";
			this.rootFolderId = rootScope.id;
			this.remoteFileSystem = provider.createRemoteFileSystem(client, rootScope.id);
		} catch (loadRootError) {
			console.warn("Failed to load remote root folder.", loadRootError);
			this.error = `Unable to load the ${provider.label} root folder.`;
			this.loading = false;
			return;
		}

		try {
			await this.refreshFolderList();
		} catch (loadError) {
			console.warn("Failed to list remote folders.", loadError);
			this.error = "Unable to list remote folders.";
		} finally {
			this.loading = false;
		}
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Select remote folder" });

		if (this.loading) {
			contentEl.createEl("p", { text: "Loading folders..." });
			return;
		}

		if (this.error) {
			contentEl.createEl("p", { text: this.error });
			return;
		}

		new Setting(contentEl)
			.setName("Create folder")
			.setDesc("Create a folder path under the remote root and select it.")
			.addText((text) =>
				text
					.setPlaceholder("notes/obsidian/sync")
					.setValue(this.createPath)
					.onChange((value) => {
						this.createPath = value;
						this.createError = null;
					}),
			)
			.addButton((button) => {
				button.setButtonText(this.creating ? "Creating..." : "Create and select");
				button.setDisabled(this.creating || this.refreshing);
				button.onClick(() => {
					void this.createAndSelectFolder();
				});
			});
		if (this.createError) {
			contentEl.createEl("p", {
				text: this.createError,
				cls: "drive-sync-folder-create-error",
			});
		}

		const list = this.getSelectableFolders();
		if (list.length === 0) {
			contentEl.createEl("p", {
				text: "No folders available to select.",
			});
			return;
		}

		const selected = this.resolveSelectedFolder(list);
		if (!selected) {
			contentEl.createEl("p", { text: "No folder available to select." });
			return;
		}

		new Setting(contentEl)
			.setName("Select folder")
			.setDesc("Choose a folder path from your remote provider.")
			.addDropdown((dropdown) => {
				for (const folder of list) {
					dropdown.addOption(folder.id, this.toOptionLabel(folder));
				}
				dropdown.setValue(selected.id).onChange((value) => {
					this.selectedFolderId = value;
				});
			})
			.addButton((button) => {
				button.setButtonText("Select");
				button.setCta();
				button.setDisabled(this.refreshing || this.creating);
				button.onClick(() => {
					const selectedFolder = list.find(
						(folder) => folder.id === this.selectedFolderId,
					);
					if (!selectedFolder) {
						new Notice("Select a folder first.");
						return;
					}
					void this.selectFolder(selectedFolder.id, selectedFolder.path ?? "");
				});
			})
			.addButton((button) => {
				button.setButtonText(this.refreshing ? "Refreshing..." : "Refresh");
				button.setDisabled(this.refreshing || this.creating);
				button.onClick(() => {
					void this.refreshFolders();
				});
			});
	}

	private getSelectableFolders(): RemoteFileEntry[] {
		return this.folders.filter((folder) => {
			const path = this.toAbsolutePath(folder.path ?? folder.name);
			if (path === "/") {
				return false;
			}
			return true;
		});
	}

	private async refreshFolderList(): Promise<void> {
		if (!this.remoteFileSystem || !this.rootFolderId) {
			this.folders = [];
			return;
		}

		const listedFolders = await this.remoteFileSystem.listFolderEntries();
		const folders = listedFolders.filter((folder) => folder.id !== this.rootFolderId);
		this.folders = [
			{
				id: this.rootFolderId,
				name: this.rootLabel,
				path: "",
				type: "folder",
			},
			...folders,
		];
	}

	private resolveSelectedFolder(list: RemoteFileEntry[]): RemoteFileEntry | null {
		if (list.length === 0) {
			return null;
		}
		if (this.selectedFolderId) {
			const selected = list.find((folder) => folder.id === this.selectedFolderId);
			if (selected) {
				return selected;
			}
		}
		const configuredId = this.plugin.getRemoteScopeId().trim();
		if (configuredId) {
			const configured = list.find((folder) => folder.id === configuredId);
			if (configured) {
				this.selectedFolderId = configured.id;
				return configured;
			}
		}
		const first = list[0];
		if (!first) {
			return null;
		}
		this.selectedFolderId = first.id;
		return first;
	}

	private async createAndSelectFolder(): Promise<void> {
		const folderPath = this.normalizeFolderPath(this.createPath.trim());
		if (!folderPath) {
			this.createError = "Enter a folder path, for example notes/obsidian/sync.";
			this.render();
			return;
		}
		if (!this.remoteFileSystem) {
			this.createError = "Unable to create folder before remote folders are loaded.";
			this.render();
			return;
		}
		if (!this.remoteFileSystem.ensureFolder) {
			this.createError = "Current remote provider does not support folder creation.";
			this.render();
			return;
		}

		this.creating = true;
		this.createError = null;
		this.render();

		try {
			const result = await this.remoteFileSystem.ensureFolder(folderPath);
			if (!result.id) {
				throw new Error("Created folder has no ID.");
			}
			await this.selectFolder(result.id, folderPath);
		} catch (error) {
			console.warn("Failed to create remote folder.", error);
			this.creating = false;
			this.createError = "Failed to create folder. Check console for details.";
			this.render();
		}
	}

	private async refreshFolders(): Promise<void> {
		if (!this.remoteFileSystem) {
			new Notice("Unable to refresh folders right now.");
			return;
		}

		this.refreshing = true;
		this.error = null;
		this.createError = null;
		this.render();
		try {
			// Rebuild client to avoid stale folder cache from provider SDK session.
			this.plugin.getRemoteProvider().disconnect();
			await this.loadFolders();
			if (this.error) {
				new Notice(this.error);
				return;
			}
			new Notice("Folder list refreshed.");
		} catch (error) {
			console.warn("Failed to refresh remote folders.", error);
			new Notice("Failed to refresh folder list.");
		} finally {
			this.refreshing = false;
			this.render();
		}
	}

	private async selectFolder(folderId: string, folderPath: string): Promise<void> {
		const absolutePath = this.toAbsolutePath(folderPath);
		this.plugin.setRemoteScope(folderId, absolutePath);
		await this.plugin.saveSettings();
		new Notice(`Remote folder selected: ${absolutePath}`);
		this.close();
	}

	private toAbsolutePath(path: string): string {
		const normalized = this.normalizeFolderPath(path);
		return normalized ? `/${normalized}` : "/";
	}

	private toOptionLabel(folder: RemoteFileEntry): string {
		const path = this.toAbsolutePath(folder.path ?? "");
		if (path === "/") {
			return "/ (root)";
		}
		return path;
	}

	private normalizeFolderPath(path: string): string {
		return normalizePath(path).replace(/\/+$/g, "");
	}
}
