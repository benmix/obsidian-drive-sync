export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\//, "");
}

export function now(): number {
	return Date.now();
}

export function backoffMs(attempt: number): number {
	const base = 1000 * Math.pow(2, Math.min(attempt, 5));
	return Math.min(base, 300000);
}
