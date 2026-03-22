import type { RemoteFileEntry, RemoteFileSystem } from "@contracts/filesystem/file-system";
import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-api";
import {
	createDriveSyncError,
	normalizeUnknownDriveSyncError,
	translateDriveSyncErrorUserMessage,
} from "@errors";
import { normalizePath } from "@filesystem/path";
import { tr, trAny } from "@i18n";
import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";

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
	private rootLabel = "";
	private rootFolderId = "";
	private remoteFileSystem: RemoteFileSystem | null = null;

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		this.render();
		void this.loadFolders();
	}

	private async loadFolders(): Promise<void> {
		this.loading = true;
		this.creating = false;
		this.error = null;
		this.createError = null;
		this.folders = [];
		this.rootFolderId = "";
		this.remoteFileSystem = null;
		const remoteState = this.plugin.getRemoteConnectionState();
		this.selectedFolderId = remoteState.scopeId.trim();
		this.render();

		const provider = remoteState.provider;
		if (!remoteState.credentials && !provider.getSession()) {
			this.error = tr("notice.signInToProviderFirst", {
				provider: provider.label,
			});
			this.loading = false;
			this.render();
			return;
		}

		let client: unknown;
		try {
			client = await this.plugin.connectRemoteClient();
		} catch (error) {
			const normalized = normalizeUnknownDriveSyncError(error, {
				category: "provider",
				userMessage: tr("notice.unableToConnectProvider", {
					provider: provider.label,
				}),
				userMessageKey: "error.provider.unableToConnectNamed",
				userMessageParams: { provider: provider.label },
			});
			this.error = translateDriveSyncErrorUserMessage(normalized, trAny);
			this.loading = false;
			this.render();
			return;
		}

		try {
			const rootScope = await provider.getRootScope(client);
			this.rootLabel = rootScope.label || tr("remoteFolder.remoteRoot");
			this.rootFolderId = rootScope.id;
			this.remoteFileSystem = provider.createRemoteFileSystem(client, rootScope.id);
		} catch (loadRootError) {
			console.warn("Failed to load remote root folder.", loadRootError);
			this.error = tr("remoteFolder.unableLoadProviderRoot", {
				provider: provider.label,
			});
			this.loading = false;
			this.render();
			return;
		}

		try {
			await this.refreshFolderList();
		} catch (loadError) {
			console.warn("Failed to list remote folders.", loadError);
			this.error = tr("remoteFolder.unableList");
		} finally {
			this.loading = false;
			this.render();
		}
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("drive-sync-remote-root-modal");

		contentEl.createEl("h2", {
			text: tr("remoteFolder.title"),
		});

		if (this.error) {
			contentEl.createEl("p", { text: this.error });
			return;
		}

		this.renderCreateFolderSetting(contentEl, this.loading);
		if (!this.loading && this.createError) {
			contentEl.createEl("p", {
				text: this.createError,
				cls: "drive-sync-folder-create-error",
			});
		}
		if (this.loading) {
			this.renderSelectFolderSetting(contentEl, [], null, true);
			return;
		}

		const list = this.getSelectableFolders();
		if (list.length === 0) {
			contentEl.createEl("p", {
				text: tr("remoteFolder.noFolders"),
			});
			return;
		}

		const selected = this.resolveSelectedFolder(list);
		if (!selected) {
			contentEl.createEl("p", {
				text: tr("remoteFolder.noFolderAvailable"),
			});
			return;
		}

		this.renderSelectFolderSetting(contentEl, list, selected, false);
	}

	private renderCreateFolderSetting(containerEl: HTMLElement, isLoading: boolean): void {
		const setting = new Setting(containerEl)
			.setName(tr("remoteFolder.createFolder"))
			.setDesc(tr("remoteFolder.createFolderDesc"));
		setting.settingEl.addClass("drive-sync-remote-folder-setting");
		if (isLoading) {
			this.renderLoadingControl(setting.controlEl, "create");
			return;
		}
		setting
			.addText((text) => {
				text.setPlaceholder(tr("remoteFolder.createPlaceholder"));
				text.setValue(this.createPath);
				text.setDisabled(this.creating || this.refreshing);
				text.onChange((value) => {
					this.createPath = value;
					this.createError = null;
				});
			})
			.addButton((button) => {
				button.setButtonText(
					this.creating
						? tr("remoteFolder.creating")
						: tr("remoteFolder.createAndSelect"),
				);
				button.setDisabled(this.creating || this.refreshing);
				button.onClick(() => {
					void this.createAndSelectFolder();
				});
			});
	}

	private renderSelectFolderSetting(
		containerEl: HTMLElement,
		list: RemoteFileEntry[],
		selected: RemoteFileEntry | null,
		isLoading: boolean,
	): void {
		const setting = new Setting(containerEl)
			.setName(tr("remoteFolder.selectFolder"))
			.setDesc(tr("remoteFolder.selectFolderDesc"));
		setting.settingEl.addClass("drive-sync-remote-folder-setting");
		if (isLoading) {
			this.renderLoadingControl(setting.controlEl, "select");
			return;
		}
		setting
			.addDropdown((dropdown) => {
				for (const folder of list) {
					dropdown.addOption(folder.id, this.toOptionLabel(folder));
				}
				if (selected) {
					dropdown.setValue(selected.id);
				}
				dropdown.setDisabled(this.refreshing || this.creating);
				dropdown.onChange((value) => {
					this.selectedFolderId = value;
				});
			})
			.addButton((button) => {
				button.setButtonText(tr("remoteFolder.select"));
				button.setCta();
				button.setDisabled(this.refreshing || this.creating);
				button.onClick(() => {
					const selectedFolder = list.find(
						(folder) => folder.id === this.selectedFolderId,
					);
					if (!selectedFolder) {
						new Notice(tr("remoteFolder.selectFolderFirst"));
						return;
					}
					void this.selectFolder(selectedFolder.id, selectedFolder.path ?? "");
				});
			})
			.addButton((button) => {
				button.setButtonText(
					this.refreshing ? tr("remoteFolder.refreshing") : tr("remoteFolder.refresh"),
				);
				button.setDisabled(this.refreshing || this.creating);
				button.onClick(() => {
					void this.refreshFolders();
				});
			});
	}

	private renderLoadingControl(containerEl: HTMLElement, variant: "create" | "select"): void {
		containerEl.empty();
		containerEl.createDiv({
			cls: `drive-sync-remote-folder-placeholder drive-sync-remote-folder-placeholder-${variant}`,
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

		const listedFolders = this.remoteFileSystem.listChildFolderEntries
			? await this.remoteFileSystem.listChildFolderEntries()
			: await this.remoteFileSystem.listFolderEntries();
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
		const configuredId = this.plugin.getRemoteConnectionState().scopeId.trim();
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
			this.createError = tr("remoteFolder.enterPathExample");
			this.render();
			return;
		}
		if (!this.remoteFileSystem) {
			this.createError = tr("remoteFolder.unableBeforeLoaded");
			this.render();
			return;
		}
		if (!this.remoteFileSystem.ensureFolder) {
			this.createError = tr("remoteFolder.providerNoCreateSupport");
			this.render();
			return;
		}

		this.creating = true;
		this.createError = null;
		this.render();

		try {
			const result = await this.remoteFileSystem.ensureFolder(folderPath);
			if (!result.id) {
				throw createDriveSyncError("REMOTE_WRITE_FAILED", {
					category: "remote_fs",
					userMessage: tr("remoteFolder.createFailed"),
					debugMessage: tr("remoteFolder.createdFolderNoId"),
					details: { path: folderPath },
				});
			}
			await this.selectFolder(result.id, folderPath);
		} catch (error) {
			const normalized = normalizeUnknownDriveSyncError(error, {
				category: "remote_fs",
				userMessage: tr("remoteFolder.createFailed"),
			});
			console.warn("Failed to create remote folder.", error);
			this.creating = false;
			this.createError = translateDriveSyncErrorUserMessage(normalized, trAny);
			this.render();
		}
	}

	private async refreshFolders(): Promise<void> {
		if (!this.remoteFileSystem) {
			new Notice(tr("remoteFolder.unableRefreshNow"));
			return;
		}

		this.refreshing = true;
		this.error = null;
		this.createError = null;
		this.render();
		try {
			// Rebuild client to avoid stale folder cache from provider SDK session.
			this.plugin.getRemoteConnectionState().provider.disconnect();
			await this.loadFolders();
			if (this.error) {
				new Notice(this.error);
				return;
			}
			new Notice(tr("remoteFolder.listRefreshed"));
		} catch (error) {
			console.warn("Failed to refresh remote folders.", error);
			new Notice(tr("remoteFolder.listRefreshFailed"));
		} finally {
			this.refreshing = false;
			this.render();
		}
	}

	private async selectFolder(folderId: string, folderPath: string): Promise<void> {
		const absolutePath = this.toAbsolutePath(folderPath);
		this.plugin.updateRemoteConnectionState({
			scopeId: folderId,
			scopePath: absolutePath,
		});
		await this.plugin.saveSettings();
		new Notice(
			tr("remoteFolder.selectedPath", {
				path: absolutePath,
			}),
		);
		this.close();
	}

	private toAbsolutePath(path: string): string {
		const normalized = this.normalizeFolderPath(path);
		return normalized ? `/${normalized}` : "/";
	}

	private toOptionLabel(folder: RemoteFileEntry): string {
		const path = this.toAbsolutePath(folder.path ?? "");
		if (path === "/") {
			return tr("remoteFolder.optionRoot");
		}
		return path;
	}

	private normalizeFolderPath(path: string): string {
		return normalizePath(path).replace(/\/+$/g, "");
	}
}
