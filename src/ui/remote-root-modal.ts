import type { App } from "obsidian";
import { Modal, Notice, Setting } from "obsidian";
import type ProtonDriveSyncPlugin from "../main";
import { ProtonDriveRemoteFs } from "../sync/remote-fs";
import type { ProtonSession } from "../proton-drive/sdk-session";
import type { RemoteFileEntry } from "../sync/types";

export class ProtonDriveRemoteRootModal extends Modal {
	private plugin: ProtonDriveSyncPlugin;
	private folders: RemoteFileEntry[] = [];
	private filter = "";
	private loading = false;
	private error: string | null = null;
	private rootLabel = "My files";

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
		this.error = null;
		this.folders = [];

		if (!this.plugin.settings.enableProtonDrive) {
			this.error = "Enable Proton Drive integration in settings first.";
			this.loading = false;
			return;
		}

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
		const remoteFs = new ProtonDriveRemoteFs(client, rootNode.uid);

		try {
			const folders = await remoteFs.listFolders();
			this.folders = [
				{
					id: rootNode.uid,
					name: rootNode.name,
					path: "/",
					type: "folder",
				},
				...folders,
			];
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
			.setName("Filter folders")
			.setDesc("Type to filter folder paths.")
			.addText((text) =>
				text
					.setPlaceholder("e.g. notes/")
					.setValue(this.filter)
					.onChange((value) => {
						this.filter = value.trim();
						this.render();
					}),
			);

		const table = contentEl.createDiv({ cls: "protondrive-folder-list" });
		const list = this.getFilteredFolders();
		if (list.length === 0) {
			table.createEl("p", { text: "No folders matched the filter." });
			return;
		}

		for (const folder of list) {
			const row = table.createDiv({ cls: "protondrive-folder-row" });
			const label = folder.path && folder.path !== "/" ? folder.path : "/";
			row.createEl("div", {
				text: `${label} (${this.rootLabel})`.replace(/\(My files\)$/, ""),
				cls: "protondrive-folder-path",
			});
			row.createEl("div", {
				text: folder.id,
				cls: "protondrive-folder-id",
			});
			const action = row.createDiv({ cls: "protondrive-folder-action" });
			const button = action.createEl("button", { text: "Select" });
			button.addEventListener("click", async () => {
				this.plugin.settings.remoteFolderId = folder.id;
				await this.plugin.saveSettings();
				new Notice("Remote folder selected.");
				this.close();
			});
		}
	}

	private getFilteredFolders(): RemoteFileEntry[] {
		const filter = this.filter.toLowerCase();
		if (!filter) {
			return this.folders;
		}
		return this.folders.filter((folder) => {
			const path = folder.path ?? folder.name;
			return path.toLowerCase().includes(filter);
		});
	}
}
