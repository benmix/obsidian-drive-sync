import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import { normalizePath } from "../sync/utils";
import { ProtonDriveRemoteFs } from "../sync/remote-fs";
import type ProtonDriveSyncPlugin from "../main";
import type { ProtonSession } from "../proton-drive/sdk-session";
import type { RemoteFileEntry } from "../sync/types";

export class ProtonDriveRemoteRootModal extends Modal {
	private plugin: ProtonDriveSyncPlugin;
	private folders: RemoteFileEntry[] = [];
	private createPath = "";
	private selectedFolderId = "";
	private loading = false;
	private refreshing = false;
	private creating = false;
	private error: string | null = null;
	private createError: string | null = null;
	private rootLabel = "My files";
	private rootFolderId = "";
	private remoteFs: ProtonDriveRemoteFs | null = null;

	constructor(app: App, plugin: ProtonDriveSyncPlugin) {
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
		this.remoteFs = null;
		this.selectedFolderId = this.plugin.settings.remoteFolderId.trim();

		if (!this.plugin.settings.protonSession || !this.plugin.settings.hasAuthSession) {
			this.error = "Sign in to Proton Drive first.";
			this.loading = false;
			return;
		}

		const session = this.plugin.authService.getSession();
		if (!session) {
			this.error = "Sign in to Proton Drive first.";
			this.loading = false;
			return;
		}
		const activeSession: ProtonSession = { ...session };
		activeSession.onTokenRefresh = async () => {
			try {
				await this.plugin.authService.refreshToken();
				const refreshedSession = this.plugin.authService.getSession();
				if (refreshedSession) {
					Object.assign(activeSession, refreshedSession);
				}
				this.plugin.settings.protonSession =
					this.plugin.authService.getReusableCredentials();
				this.plugin.settings.hasAuthSession = true;
				await this.plugin.saveSettings();
			} catch (refreshError) {
				console.warn("Failed to refresh Proton session.", refreshError);
				this.plugin.settings.hasAuthSession = false;
				await this.plugin.saveSettings();
			}
		};
		const client = await this.plugin.protonDriveService.connect(activeSession);
		if (!client) {
			this.error = "Unable to connect to Proton Drive.";
			this.loading = false;
			return;
		}

		const rootResult =
			typeof (client as { getMyFilesRootFolder?: () => Promise<unknown> })
				.getMyFilesRootFolder === "function"
				? await (
						client as {
							getMyFilesRootFolder: () => Promise<unknown>;
						}
					).getMyFilesRootFolder()
				: null;
		if (!rootResult || !(rootResult as { ok?: boolean }).ok) {
			this.error = "Unable to load the Proton Drive root folder.";
			this.loading = false;
			return;
		}

		const rootNode = (rootResult as { value: { uid: string; name: string } }).value;
		this.rootLabel = rootNode.name || "My files";
		this.rootFolderId = rootNode.uid;
		this.remoteFs = new ProtonDriveRemoteFs(client, rootNode.uid);

		try {
			await this.refreshFolderList();
		} catch (loadError) {
			console.warn("Failed to list Proton Drive folders.", loadError);
			this.error = "Unable to list Proton Drive folders.";
		} finally {
			this.loading = false;
		}
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Select Proton Drive folder" });

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
			.setDesc("Create a folder path under My files and select it.")
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
				cls: "protondrive-folder-create-error",
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
			.setDesc("Choose a folder path from Proton Drive.")
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
		if (!this.remoteFs || !this.rootFolderId) {
			this.folders = [];
			return;
		}
		const folders = await this.remoteFs.listFolders();
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
		const configuredId = this.plugin.settings.remoteFolderId.trim();
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
		if (!this.remoteFs) {
			this.createError = "Unable to create folder before drive folders are loaded.";
			this.render();
			return;
		}

		this.creating = true;
		this.createError = null;
		this.render();

		try {
			const result = await this.remoteFs.createFolder(folderPath);
			if (!result.id) {
				throw new Error("Created folder has no ID.");
			}
			await this.selectFolder(result.id, folderPath);
		} catch (error) {
			console.warn("Failed to create Proton Drive folder.", error);
			this.creating = false;
			this.createError = "Failed to create folder. Check console for details.";
			this.render();
		}
	}

	private async refreshFolders(): Promise<void> {
		if (!this.remoteFs) {
			new Notice("Unable to refresh folders right now.");
			return;
		}

		this.refreshing = true;
		this.error = null;
		this.createError = null;
		this.render();
		try {
			// Rebuild SDK client to avoid stale folder cache in the current session.
			this.plugin.protonDriveService.disconnect();
			await this.loadFolders();
			if (this.error) {
				new Notice(this.error);
				return;
			}
			new Notice("Folder list refreshed.");
		} catch (error) {
			console.warn("Failed to refresh Proton Drive folders.", error);
			new Notice("Failed to refresh folder list.");
		} finally {
			this.refreshing = false;
			this.render();
		}
	}

	private async selectFolder(folderId: string, folderPath: string): Promise<void> {
		const absolutePath = this.toAbsolutePath(folderPath);
		this.plugin.settings.remoteFolderId = folderId;
		this.plugin.settings.remoteFolderPath = absolutePath;
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
