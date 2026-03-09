import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { exportDiagnostics } from "../runtime/use-cases/diagnostics";

export function registerDriveSyncExportDiagnosticsCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-export-diagnostics",
		name: tr("commands.exportDiagnostics.name"),
		callback: async () => {
			try {
				const path = await exportDiagnostics(plugin.app, plugin);
				new Notice(tr("notice.diagnosticsExportedTo", { path }));
			} catch (error) {
				console.warn("Diagnostics export failed.", error);
				new Notice(tr("notice.diagnosticsExportFailed"));
			}
		},
	});
}
