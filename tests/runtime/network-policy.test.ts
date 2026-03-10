import { describe, expect, test } from "vitest";

import { createDriveSyncError } from "../../src/errors";
import { NetworkPolicy } from "../../src/runtime/network-policy";

describe("NetworkPolicy", () => {
	test("allows all runs when policy is disabled", () => {
		let nowTs = 1000;
		const policy = new NetworkPolicy(() => ({
			enabled: false,
			now: () => nowTs,
			isOnline: () => false,
		}));

		expect(policy.canRun({ force: false })).toEqual({ allowed: true });
		policy.recordFailure(
			createDriveSyncError("NETWORK_TEMPORARY_FAILURE", {
				category: "network",
				retryable: true,
			}),
		);
		nowTs += 5000;
		expect(policy.canRun({ force: false })).toEqual({ allowed: true });
	});

	test("blocks runs when online-only policy detects offline state", () => {
		const policy = new NetworkPolicy(() => ({
			enabled: true,
			onlineOnly: true,
			now: () => 1000,
			isOnline: () => false,
		}));

		expect(policy.canRun({ force: false })).toEqual({
			allowed: false,
			reason: "Network offline. Sync deferred by policy.",
		});
	});

	test("applies cooldown for transient network failures", () => {
		let nowTs = 1000;
		const policy = new NetworkPolicy(() => ({
			enabled: true,
			failureCooldownMs: 5000,
			now: () => nowTs,
			isOnline: () => true,
		}));

		policy.recordFailure(
			createDriveSyncError("NETWORK_TEMPORARY_FAILURE", {
				category: "network",
				retryable: true,
			}),
		);
		nowTs = 2500;
		expect(policy.canRun({ force: false })).toEqual({
			allowed: false,
			reason: "Network cooling down after transient errors.",
			retryAfterMs: 3500,
		});

		expect(policy.canRun({ force: true })).toEqual({ allowed: true });

		nowTs = 6100;
		expect(policy.canRun({ force: false })).toEqual({ allowed: true });
	});

	test("ignores non-transient failures", () => {
		const policy = new NetworkPolicy(() => ({
			enabled: true,
			failureCooldownMs: 5000,
			now: () => 1000,
			isOnline: () => true,
		}));

		policy.recordFailure(
			createDriveSyncError("AUTH_REAUTH_REQUIRED", {
				category: "auth",
			}),
		);
		expect(policy.canRun({ force: false })).toEqual({ allowed: true });
	});
});
