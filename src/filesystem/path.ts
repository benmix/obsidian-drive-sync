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
