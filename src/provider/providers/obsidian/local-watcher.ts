import type { LocalChange } from "@contracts/filesystem/file-system";
import type { LocalChangeHandler } from "@contracts/provider/local-provider";
import { normalizePath } from "@filesystem/path";
import { type App, type EventRef, type TAbstractFile, TFile, TFolder } from "obsidian";

export class ObsidianLocalFileSystemWatcher {
	private app: App;
	private debounceMs: number;
	private handler: LocalChangeHandler;
	private pending: Map<string, LocalChange> = new Map();
	private timer: number | null = null;
	private registerEvent: (eventRef: EventRef) => void;

	constructor(
		app: App,
		handler: LocalChangeHandler,
		registerEvent: (eventRef: EventRef) => void,
		debounceMs = 500,
	) {
		this.app = app;
		this.handler = handler;
		this.registerEvent = registerEvent;
		this.debounceMs = debounceMs;
	}

	start(): void {
		this.registerEvent(
			this.app.vault.on("create", (...args: unknown[]) => {
				const file = args[0] as TAbstractFile | undefined;
				if (file) {
					this.onCreate(file);
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("modify", (...args: unknown[]) => {
				const file = args[0] as TAbstractFile | undefined;
				if (file) {
					this.onModify(file);
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (...args: unknown[]) => {
				const file = args[0] as TAbstractFile | undefined;
				if (file) {
					this.onDelete(file);
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (...args: unknown[]) => {
				const file = args[0] as TAbstractFile | undefined;
				const oldPath = args[1] as string | undefined;
				if (file && oldPath) {
					this.onRename(file, oldPath);
				}
			}),
		);
	}

	stop(): void {
		this.clearTimer();
		this.pending.clear();
	}

	private onCreate = (file: TAbstractFile) => {
		const change: LocalChange = {
			type: "create",
			path: normalizePath(file.path),
			entryType: file instanceof TFolder ? "folder" : "file",
		};
		this.queue(change);
	};

	private onModify = (file: TAbstractFile) => {
		const change: LocalChange = {
			type: "modify",
			path: normalizePath(file.path),
			entryType: file instanceof TFile ? "file" : "folder",
		};
		this.queue(change);
	};

	private onDelete = (file: TAbstractFile) => {
		const change: LocalChange = {
			type: "delete",
			path: normalizePath(file.path),
			entryType: file instanceof TFolder ? "folder" : "file",
		};
		this.queue(change);
	};

	private onRename = (file: TAbstractFile, oldPath: string) => {
		const change: LocalChange = {
			type: "rename",
			from: normalizePath(oldPath),
			to: normalizePath(file.path),
			entryType: file instanceof TFolder ? "folder" : "file",
		};
		this.queue(change);
	};

	private queue(change: LocalChange) {
		const key = change.type === "rename" ? `${change.from}->${change.to}` : change.path;
		this.pending.set(key, change);
		this.scheduleFlush();
	}

	private scheduleFlush() {
		if (this.timer !== null) {
			return;
		}
		this.timer = window.setTimeout(() => this.flush(), this.debounceMs);
	}

	private flush() {
		const changes = [...this.pending.values()];
		this.pending.clear();
		this.clearTimer();
		changes.forEach((change) => this.handler(change));
	}

	private clearTimer() {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
	}
}
