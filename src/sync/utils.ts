export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\//, "");
}

export function splitPath(path: string): string[] {
	const normalized = normalizePath(path);
	if (!normalized) {
		return [];
	}
	return normalized.split("/").filter(Boolean);
}

export function dirname(path: string): string {
	const parts = splitPath(path);
	if (parts.length <= 1) {
		return "";
	}
	return parts.slice(0, -1).join("/");
}

export function basename(path: string): string {
	const parts = splitPath(path);
	return parts[parts.length - 1] ?? "";
}

export function buildConflictName(path: string, timestampMs: number): string {
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
	const conflictName = `${base} (Proton conflicted ${formatted})${ext}`;
	const parent = parts.join("/");
	return parent ? `${parent}/${conflictName}` : conflictName;
}

export function now(): number {
	return Date.now();
}

export function backoffMs(attempt: number): number {
	const base = 1000 * Math.pow(2, Math.min(attempt, 5));
	return Math.min(base, 300000);
}
