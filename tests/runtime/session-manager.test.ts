import type { SyncState } from "@contracts/sync/state";
import { beforeEach, describe, expect, test, vi } from "vitest";

const stateHarness = vi.hoisted(() => ({
	state: {
		entries: {},
		jobs: [],
		logs: [],
		runtimeMetrics: {},
	} as SyncState,
}));

vi.mock("@sync/state/state-store", () => ({
	PluginDataStateStore: class {
		async load() {
			return stateHarness.state;
		}

		async save(state: typeof stateHarness.state) {
			stateHarness.state = state;
		}
	},
}));

vi.mock("@i18n", () => ({
	trAny: (key: string) => {
		if (key === "error.auth.reauthRequired") {
			return "Authentication required. Sign in again to continue.";
		}
		return key;
	},
}));

import { createDriveSyncError } from "@errors";
import { SessionManager } from "@runtime/session-manager";

describe("SessionManager", () => {
	beforeEach(() => {
		stateHarness.state = {
			entries: {},
			jobs: [],
			logs: [],
			runtimeMetrics: {},
		} as SyncState;
		vi.restoreAllMocks();
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	test("records structured auth state and log when restoring a session fails", async () => {
		const plugin = {
			getRemoteConnectionState: () => ({
				provider: {
					restore: async () => {
						throw createDriveSyncError("AUTH_SESSION_EXPIRED", {
							category: "auth",
						});
					},
					getReusableCredentials: () => {},
				},
				credentials: { token: "secret" },
			}),
			updateRemoteConnectionState: vi.fn(),
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

	test("restores and persists a stored session when no active session is loaded", async () => {
		const session = { accessToken: "token" };
		const reusableCredentials = { token: "next-secret" };
		const plugin = {
			getRemoteConnectionState: () => ({
				provider: {
					getSession: () => null,
					restore: vi.fn(async () => session),
					getReusableCredentials: () => reusableCredentials,
				},
				credentials: { token: "secret" },
			}),
			updateRemoteConnectionState: vi.fn(),
			clearStoredRemoteSession: vi.fn(),
			saveSettings: vi.fn(async () => {}),
		};
		const manager = new SessionManager(plugin as never);

		await expect(manager.buildActiveRemoteSession()).resolves.toBe(session);
		expect(plugin.updateRemoteConnectionState).toHaveBeenCalledWith({
			credentials: reusableCredentials,
			hasAuthSession: true,
		});
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		expect(manager.isAuthPaused()).toBe(false);
	});

	test("pauses auth and persists diagnostics when token refresh fails during connect", async () => {
		const refreshError = createDriveSyncError("AUTH_SESSION_EXPIRED", {
			category: "auth",
		});
		let refreshCallback: (() => Promise<void>) | undefined;
		const plugin = {
			getRemoteConnectionState: () => ({
				provider: {
					id: "proton-drive",
					label: "Proton Drive",
					getSession: () => ({ accessToken: "token" }),
					connect: vi.fn(async (_session, options) => {
						refreshCallback = options?.onTokenRefresh;
						return { connected: true };
					}),
					refreshToken: vi.fn(async () => {
						throw refreshError;
					}),
					getReusableCredentials: () => ({ token: "secret" }),
				},
				credentials: { token: "secret" },
			}),
			updateRemoteConnectionState: vi.fn(),
			clearStoredRemoteSession: vi.fn(),
			saveSettings: vi.fn(async () => {}),
		};
		const manager = new SessionManager(plugin as never);

		await expect(manager.connectClient()).resolves.toEqual({
			connected: true,
		});
		await expect(refreshCallback?.()).rejects.toMatchObject({
			code: "AUTH_SESSION_EXPIRED",
		});
		expect(plugin.updateRemoteConnectionState).toHaveBeenCalledWith({
			hasAuthSession: false,
		});
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		expect(manager.isAuthPaused()).toBe(true);
		expect(stateHarness.state.logs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "Remote session refresh failed",
					code: "AUTH_SESSION_EXPIRED",
				}),
			]),
		);
	});
});
