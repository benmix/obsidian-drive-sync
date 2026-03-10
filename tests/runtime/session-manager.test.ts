import { beforeEach, describe, expect, test, vi } from "vitest";

const stateHarness = vi.hoisted(() => ({
	state: {
		entries: {},
		jobs: [],
		logs: [],
		runtimeMetrics: {},
	},
}));

vi.mock("../../src/sync/state/state-store", () => ({
	PluginDataStateStore: class {
		async load() {
			return stateHarness.state;
		}

		async save(state: typeof stateHarness.state) {
			stateHarness.state = state;
		}
	},
}));

vi.mock("../../src/i18n", () => ({
	trAny: (key: string) => {
		if (key === "error.auth.reauthRequired") {
			return "Authentication required. Sign in again to continue.";
		}
		return key;
	},
}));

import { createDriveSyncError } from "../../src/errors";
import { SessionManager } from "../../src/runtime/session-manager";

describe("SessionManager", () => {
	beforeEach(() => {
		stateHarness.state = {
			entries: {},
			jobs: [],
			logs: [],
			runtimeMetrics: {},
		};
		vi.restoreAllMocks();
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	test("records structured auth state and log when restoring a session fails", async () => {
		const plugin = {
			getRemoteProvider: () => ({
				restore: async () => {
					throw createDriveSyncError("AUTH_SESSION_EXPIRED", {
						category: "auth",
					});
				},
				getReusableCredentials: () => {},
			}),
			getStoredProviderCredentials: () => ({ token: "secret" }),
			setStoredProviderCredentials: vi.fn(),
			setRemoteAuthSession: vi.fn(),
			clearStoredRemoteSession: vi.fn(),
			saveSettings: vi.fn(async () => {}),
		};
		const manager = new SessionManager(plugin as never);

		await manager.restoreSession();

		expect(manager.isAuthPaused()).toBe(true);
		expect(manager.getLastAuthError()).toBe(
			"Authentication required. Sign in again to continue.",
		);
		expect(stateHarness.state).toMatchObject({
			lastErrorCode: "AUTH_SESSION_EXPIRED",
			lastErrorCategory: "auth",
			lastErrorRetryable: false,
		});
		expect(stateHarness.state.lastErrorAt).toEqual(expect.any(Number));
		expect(stateHarness.state.logs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					context: "auth",
					message: "Remote session restore failed",
					code: "AUTH_SESSION_EXPIRED",
					category: "auth",
					retryable: false,
				}),
			]),
		);
	});
});
