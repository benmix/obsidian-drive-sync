import { type App, type EventRef } from "obsidian";
import { DEFAULT_LOCAL_PROVIDER_ID, type LocalProvider } from "../../contracts";
import { type LocalChange } from "../../../filesystem/contracts";
import { ObsidianLocalFileSystem } from "./local-file-system";
import { ObsidianLocalFileSystemWatcher } from "./local-watcher";

export class ObsidianLocalProvider implements LocalProvider {
	readonly id = DEFAULT_LOCAL_PROVIDER_ID;
	readonly label = "Obsidian Vault";

	createLocalFileSystem(app: App) {
		return new ObsidianLocalFileSystem(app);
	}

	createLocalWatcher(
		app: App,
		onChange: (change: LocalChange) => void,
		registerEvent: (eventRef: EventRef) => void,
		debounceMs = 500,
	) {
		return new ObsidianLocalFileSystemWatcher(app, onChange, registerEvent, debounceMs);
	}
}

export function createObsidianLocalProvider(): ObsidianLocalProvider {
	return new ObsidianLocalProvider();
}
