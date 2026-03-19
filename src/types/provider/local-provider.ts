import type { LocalChange, LocalFileSystem } from "@contracts/filesystem/file-system";
import type { LocalProviderId } from "@contracts/provider/provider-ids";
import type { App, EventRef } from "obsidian";

export type LocalChangeWatcher = {
	start(): void;
	stop(): void;
};

export type LocalChangeHandler = (change: LocalChange) => void;

export interface LocalProvider {
	readonly id: LocalProviderId;
	readonly label: string;
	createLocalFileSystem(app: App): LocalFileSystem;
	createLocalWatcher(
		app: App,
		onChange: LocalChangeHandler,
		registerEvent: (eventRef: EventRef) => void,
		debounceMs?: number,
	): LocalChangeWatcher;
}
