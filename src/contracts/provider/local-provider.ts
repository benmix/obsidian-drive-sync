import type { App, EventRef } from "obsidian";

import type { LocalChange, LocalFileSystem } from "../filesystem/file-system";

import type { LocalProviderId } from "./provider-ids";

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
