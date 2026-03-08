import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { exportDiagnostics } from "../runtime/use-cases/diagnostics";

export function registerDriveSyncExportDiagnosticsCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-export-diagnostics",
		name: "Export diagnostics",
		callback: async () => {
			try {
				const path = await exportDiagnostics(plugin.app, plugin);
				new Notice(`Diagnostics exported to ${path}.`);
			} catch (error) {
				console.warn("Diagnostics export failed.", error);
				new Notice("Diagnostics export failed. Check the console for details.");
			}
		},
	});
}
