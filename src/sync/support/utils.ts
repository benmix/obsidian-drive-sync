import { splitPath } from "../../filesystem/path";

export function buildConflictName(
	path: string,
	timestampMs: number,
	source: "local" | "remote",
): string {
	const parts = splitPath(path);
	if (parts.length === 0) {
		return "conflicted";
	}
	const name = parts.pop() ?? "";
	const dotIndex = name.lastIndexOf(".");
	const base = dotIndex === -1 ? name : name.slice(0, dotIndex);
	const ext = dotIndex === -1 ? "" : name.slice(dotIndex);
	const dt = new Date(timestampMs);
	const formatted = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
		2,
		"0",
	)}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(
		2,
		"0",
	)}${String(dt.getMinutes()).padStart(2, "0")}`;
	const conflictName = `${base} (conflicted ${source} ${formatted})${ext}`;
	const parent = parts.join("/");
	return parent ? `${parent}/${conflictName}` : conflictName;
}

export function now(): number {
	return Date.now();
}

export function formatBytes(value?: number): string {
	if (!value || value <= 0) {
		return "0 B";
	}
	const units = ["B", "KB", "MB", "GB", "TB"];
	let size = value;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex += 1;
	}
	const rounded = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10;
	return `${rounded} ${units[unitIndex]}`;
}

export function backoffMs(attempt: number): number {
	const base = 1000 * Math.pow(2, Math.min(attempt, 5));
	return Math.min(base, 300000);
}
