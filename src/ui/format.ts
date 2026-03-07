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
