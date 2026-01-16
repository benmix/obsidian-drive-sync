import type { App, TAbstractFile, EventRef } from "obsidian";
import { normalizePath } from "./utils";

export type LocalChange =
	| { type: "create"; path: string }
	| { type: "modify"; path: string }
	| { type: "delete"; path: string }
	| { type: "rename"; from: string; to: string };

export type LocalChangeHandler = (change: LocalChange) => void;

export class LocalFsWatcher {
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
		this.registerEvent(this.app.vault.on("create", this.onCreate));
		this.registerEvent(this.app.vault.on("modify", this.onModify));
		this.registerEvent(this.app.vault.on("delete", this.onDelete));
		this.registerEvent(this.app.vault.on("rename", this.onRename));
	}

	stop(): void {
		this.app.vault.off("create", this.onCreate);
		this.app.vault.off("modify", this.onModify);
		this.app.vault.off("delete", this.onDelete);
		this.app.vault.off("rename", this.onRename);
		this.clearTimer();
		this.pending.clear();
	}

	private onCreate = (file: TAbstractFile) => {
		this.queue({ type: "create", path: normalizePath(file.path) });
	};

	private onModify = (file: TAbstractFile) => {
		this.queue({ type: "modify", path: normalizePath(file.path) });
	};

	private onDelete = (file: TAbstractFile) => {
		this.queue({ type: "delete", path: normalizePath(file.path) });
	};

	private onRename = (file: TAbstractFile, oldPath: string) => {
		this.queue({
			type: "rename",
			from: normalizePath(oldPath),
			to: normalizePath(file.path),
		});
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
