import type { NetworkDecision } from "../contracts/runtime/network-policy";
import {
	createDriveSyncError,
	isTransientNetworkDriveSyncError,
	normalizeUnknownDriveSyncError,
} from "../errors";

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
			const offlineError = createDriveSyncError("NETWORK_TEMPORARY_FAILURE", {
				category: "network",
				retryable: true,
				userMessage: "Network offline. Sync deferred by policy.",
				userMessageKey: undefined,
			});
			return {
				allowed: false,
				reason: offlineError.userMessage,
			};
		}

		const nowTs = options.now();
		if (!gate.force && nowTs < this.cooldownUntil) {
			const cooldownError = createDriveSyncError("NETWORK_TEMPORARY_FAILURE", {
				category: "network",
				retryable: true,
				userMessage: "Network cooling down after transient errors.",
				userMessageKey: undefined,
			});
			return {
				allowed: false,
				reason: cooldownError.userMessage,
				retryAfterMs: Math.max(0, this.cooldownUntil - nowTs),
			};
		}

		return { allowed: true };
	}

	recordFailure(error: unknown): void {
		const options = this.resolveOptions();
		if (!options.enabled) {
			return;
		}
		const normalized = normalizeUnknownDriveSyncError(error, classifyTransientFailure(error));
		if (!isTransientNetworkDriveSyncError(normalized)) {
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

function extractStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object") {
		return undefined;
	}
	const statusValue = (error as { status?: unknown }).status;
	return typeof statusValue === "number" ? statusValue : undefined;
}

function classifyTransientFailure(error: unknown): {
	code?: "NETWORK_TIMEOUT" | "NETWORK_RATE_LIMITED" | "NETWORK_TEMPORARY_FAILURE";
	category?: "network";
	retryable?: true;
} {
	const status = extractStatus(error);
	if (status === 429) {
		return {
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
		};
	}
	if (
		status === 408 ||
		status === 425 ||
		status === 500 ||
		status === 502 ||
		status === 503 ||
		status === 504
	) {
		return {
			code: "NETWORK_TEMPORARY_FAILURE",
			category: "network",
			retryable: true,
		};
	}
	return {};
}
