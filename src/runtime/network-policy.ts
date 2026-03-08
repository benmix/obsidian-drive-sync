import type { NetworkDecision } from "../contracts/runtime/network-policy";

type NetworkPolicyOptions = {
	enabled: boolean;
	onlineOnly?: boolean;
	failureCooldownMs?: number;
	now?: () => number;
	isOnline?: () => boolean;
};

type NetworkGate = {
	force: boolean;
};

const DEFAULT_FAILURE_COOLDOWN_MS = 30_000;

export class NetworkPolicy {
	private cooldownUntil = 0;

	constructor(private readonly getOptions: () => NetworkPolicyOptions) {}

	canRun(gate: NetworkGate): NetworkDecision {
		const options = this.resolveOptions();
		if (!options.enabled) {
			return { allowed: true };
		}

		if (options.onlineOnly && !options.isOnline()) {
			return {
				allowed: false,
				reason: "Network offline. Sync deferred by policy.",
			};
		}

		const nowTs = options.now();
		if (!gate.force && nowTs < this.cooldownUntil) {
			return {
				allowed: false,
				reason: "Network cooling down after transient errors.",
				retryAfterMs: Math.max(0, this.cooldownUntil - nowTs),
			};
		}

		return { allowed: true };
	}

	recordFailure(error: unknown): void {
		const options = this.resolveOptions();
		if (!options.enabled || !isTransientNetworkError(error)) {
			return;
		}
		const until = options.now() + options.failureCooldownMs;
		if (until > this.cooldownUntil) {
			this.cooldownUntil = until;
		}
	}

	recordSuccess(): void {
		this.cooldownUntil = 0;
	}

	reset(): void {
		this.cooldownUntil = 0;
	}

	private resolveOptions(): Required<NetworkPolicyOptions> {
		const options = this.getOptions();
		return {
			enabled: options.enabled,
			onlineOnly: options.onlineOnly ?? true,
			failureCooldownMs: options.failureCooldownMs ?? DEFAULT_FAILURE_COOLDOWN_MS,
			now: options.now ?? (() => Date.now()),
			isOnline: options.isOnline ?? defaultIsOnline,
		};
	}
}

function defaultIsOnline(): boolean {
	const navigatorRef = globalThis.navigator as { onLine?: unknown } | undefined;
	if (!navigatorRef || typeof navigatorRef.onLine !== "boolean") {
		return true;
	}
	return navigatorRef.onLine;
}

function isTransientNetworkError(error: unknown): boolean {
	const status = extractStatus(error);
	if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
		return true;
	}

	const message = error instanceof Error ? error.message : String(error ?? "");
	const normalized = message.toLowerCase();

	return (
		normalized.includes("failed to fetch") ||
		normalized.includes("network error") ||
		normalized.includes("networkerror") ||
		normalized.includes("timeout") ||
		normalized.includes("timed out") ||
		normalized.includes("etimedout") ||
		normalized.includes("econnreset") ||
		normalized.includes("econnrefused") ||
		normalized.includes("rate limit") ||
		normalized.includes("too many requests") ||
		normalized.includes("429") ||
		normalized.includes("503") ||
		normalized.includes("504")
	);
}

function extractStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object") {
		return undefined;
	}
	const statusValue = (error as { status?: unknown }).status;
	return typeof statusValue === "number" ? statusValue : undefined;
}
