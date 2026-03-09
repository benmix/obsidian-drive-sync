export const INITIALIZATION_MTIME_TOLERANCE_MS = 1_000;

export function compareMtimeWithTolerance(
	leftMtimeMs?: number,
	rightMtimeMs?: number,
	toleranceMs = INITIALIZATION_MTIME_TOLERANCE_MS,
): -1 | 0 | 1 | undefined {
	if (typeof leftMtimeMs !== "number" || typeof rightMtimeMs !== "number") {
		return undefined;
	}

	const delta = leftMtimeMs - rightMtimeMs;
	if (Math.abs(delta) <= toleranceMs) {
		return 0;
	}
	return delta > 0 ? 1 : -1;
}
