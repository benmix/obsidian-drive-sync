import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { exportDiagnostics } from "@runtime/use-cases/diagnostics";
import { Notice } from "obsidian";

export function registerDriveSyncExportDiagnosticsCommand(context: CommandContext) {
	const { plugin, showCommandError } = context;
	plugin.addCommand({
		id: "drive-sync-export-diagnostics",
		name: tr("commands.exportDiagnostics.name"),
		callback: async () => {
			try {
				const path = await exportDiagnostics(plugin.app, plugin);
				new Notice(tr("notice.diagnosticsExportedTo", { path }));
			} catch (error) {
				showCommandError(error, {
					logMessage: "Diagnostics export failed.",
					noticeKey: "notice.diagnosticsExportFailed",
				});
			}
		},
	});
}
