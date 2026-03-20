import { INVALID_REFRESH_TOKEN_CODE } from "@contracts/provider/proton/auth-types";
import { beforeEach, describe, expect, test, vi } from "vitest";

type SessionShape = {
	UID: string;
	AccessToken: string;
	RefreshToken: string;
};

const requestHttpMock = vi.hoisted(() =>
	vi.fn(async () => new Response(JSON.stringify({ Code: 1000 }), { status: 200 })),
);

vi.mock("@provider/providers/proton-drive/transport/http", () => ({
	requestHttp: requestHttpMock,
}));

import { ProtonAuth } from "@provider/providers/proton-drive/auth/client";

describe("ProtonAuth", () => {
	beforeEach(() => {
		requestHttpMock.mockReset();
		requestHttpMock.mockResolvedValue(
			new Response(JSON.stringify({ Code: 1000 }), { status: 200 }),
		);
	});

	test("logout revokes child and parent sessions and clears auth state", async () => {
		const auth = new ProtonAuth() as unknown as {
			logout(): Promise<void>;
			store: {
				setAuthenticated: (sessions: {
					parentSession: SessionShape;
					childSession: SessionShape;
				}) => void;
				getState: () => { kind: string };
				getSession: () => unknown;
				getParentSession: () => unknown;
			};
		};
		auth.store.setAuthenticated({
			childSession: {
				UID: "child-uid",
				AccessToken: "child-access",
				RefreshToken: "child-refresh",
			},
			parentSession: {
				UID: "parent-uid",
				AccessToken: "parent-access",
				RefreshToken: "parent-refresh",
			},
		});

		await auth.logout();

		expect(requestHttpMock).toHaveBeenCalledTimes(2);
		expect(requestHttpMock).toHaveBeenNthCalledWith(
			1,
			"https://api.protonmail.ch/core/v4/auth",
			expect.objectContaining({
				method: "DELETE",
				headers: expect.objectContaining({
					"x-pm-uid": "child-uid",
					Authorization: "Bearer child-access",
				}),
			}),
			"json",
		);
		expect(requestHttpMock).toHaveBeenNthCalledWith(
			2,
			"https://api.protonmail.ch/core/v4/auth",
			expect.objectContaining({
				method: "DELETE",
				headers: expect.objectContaining({
					"x-pm-uid": "parent-uid",
					Authorization: "Bearer parent-access",
				}),
			}),
			"json",
		);
		expect(auth.store.getState()).toEqual({ kind: "idle" });
		expect(auth.store.getSession()).toBeNull();
		expect(auth.store.getParentSession()).toBeNull();
	});

	test("logout still clears all session state when revoke requests fail", async () => {
		const auth = new ProtonAuth() as unknown as {
			logout(): Promise<void>;
			store: {
				setAuthenticated: (sessions: {
					parentSession: SessionShape;
					childSession: SessionShape;
				}) => void;
				getState: () => { kind: string };
				getSession: () => unknown;
				getParentSession: () => unknown;
			};
		};
		auth.store.setAuthenticated({
			childSession: {
				UID: "child-uid",
				AccessToken: "child-access",
				RefreshToken: "child-refresh",
			},
			parentSession: {
				UID: "parent-uid",
				AccessToken: "parent-access",
				RefreshToken: "parent-refresh",
			},
		});
		requestHttpMock.mockRejectedValueOnce(new Error("network down"));
		requestHttpMock.mockRejectedValueOnce(new Error("still down"));

		await expect(auth.logout()).resolves.toBeUndefined();
		expect(requestHttpMock).toHaveBeenCalledTimes(2);
		expect(auth.store.getState()).toEqual({ kind: "idle" });
		expect(auth.store.getSession()).toBeNull();
		expect(auth.store.getParentSession()).toBeNull();
	});

	test("submitMailboxPassword clears auth state when child fork fails", async () => {
		const apiClient = {
			getUser: vi.fn(async () => ({ ID: "user-1", Keys: [] })),
			getKeySalts: vi.fn(async () => []),
			getAddresses: vi.fn(async () => []),
			refreshTokens: vi.fn(async () => {
				const error = new Error("temporary outage") as Error & {
					status?: number;
				};
				error.status = 503;
				throw error;
			}),
		};
		const keyService = {
			hydrateSessionFromPassword: vi.fn(async (session: Record<string, unknown>) => ({
				...session,
				keyPassword: "salted-key-pass",
			})),
		};
		const auth = new ProtonAuth(apiClient as never, keyService as never) as unknown as {
			submitMailboxPassword(password: string): Promise<unknown>;
			store: {
				beginMailboxPasswordChallenge: (parentSession: SessionShape) => void;
				getState: () => { kind: string };
				getSession: () => unknown;
				getParentSession: () => unknown;
			};
		};

		auth.store.beginMailboxPasswordChallenge({
			UID: "parent-uid",
			AccessToken: "parent-access",
			RefreshToken: "parent-refresh",
		});

		await expect(auth.submitMailboxPassword("mailbox-pass")).rejects.toMatchObject({
			status: 503,
		});
		expect(auth.store.getState()).toEqual({ kind: "idle" });
		expect(auth.store.getSession()).toBeNull();
		expect(auth.store.getParentSession()).toBeNull();
	});

	test("refreshToken forks a new child without refreshing the parent twice", async () => {
		const refreshTokens = vi
			.fn()
			.mockImplementationOnce(async () => {
				const error = new Error("invalid refresh token") as Error & {
					code?: number;
					status?: number;
				};
				error.code = INVALID_REFRESH_TOKEN_CODE;
				error.status = 401;
				throw error;
			})
			.mockImplementationOnce(async () => ({
				accessToken: "parent-access-2",
				refreshToken: "parent-refresh-2",
			}));
		const apiClient = {
			refreshTokens,
			pushForkSession: vi.fn(async () => ({
				Code: 1000,
				Selector: "selector-1",
			})),
			pullForkSession: vi.fn(async () => ({
				Code: 1000,
				UID: "child-uid-2",
				AccessToken: "child-access-2",
				RefreshToken: "child-refresh-2",
				UserID: "user-1",
			})),
		};
		const auth = new ProtonAuth(apiClient as never) as unknown as {
			refreshToken(): Promise<unknown>;
			store: {
				setAuthenticated: (sessions: {
					parentSession: {
						UID: string;
						AccessToken: string;
						RefreshToken: string;
						keyPassword: string;
						UserID: string;
					};
					childSession: {
						UID: string;
						AccessToken: string;
						RefreshToken: string;
						keyPassword: string;
						UserID: string;
					};
				}) => void;
			};
		};
		auth.store.setAuthenticated({
			parentSession: {
				UID: "parent-uid",
				AccessToken: "parent-access-1",
				RefreshToken: "parent-refresh-1",
				keyPassword: "salted-key-pass",
				UserID: "user-1",
			},
			childSession: {
				UID: "child-uid-1",
				AccessToken: "child-access-1",
				RefreshToken: "child-refresh-1",
				keyPassword: "salted-key-pass",
				UserID: "user-1",
			},
		});

		const session = await auth.refreshToken();

		expect(session).toMatchObject({
			UID: "child-uid-2",
			AccessToken: "child-access-2",
			RefreshToken: "child-refresh-2",
		});
		expect(refreshTokens).toHaveBeenCalledTimes(2);
		expect(refreshTokens).toHaveBeenNthCalledWith(1, "child-uid-1", "child-refresh-1");
		expect(refreshTokens).toHaveBeenNthCalledWith(2, "parent-uid", "parent-refresh-1");
	});
});
