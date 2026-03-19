import { beforeEach, describe, expect, test, vi } from "vitest";

const requestHttpMock = vi.hoisted(() =>
	vi.fn(async () => new Response(JSON.stringify({ Code: 1000 }), { status: 200 })),
);

vi.mock("../../src/provider/providers/proton-drive/sdk/proton-auth/http", () => ({
	requestHttp: requestHttpMock,
}));

import { ProtonAuth } from "../../src/provider/providers/proton-drive/sdk/proton-auth/core";

describe("ProtonAuth", () => {
	beforeEach(() => {
		requestHttpMock.mockReset();
		requestHttpMock.mockResolvedValue(
			new Response(JSON.stringify({ Code: 1000 }), { status: 200 }),
		);
	});

	test("logout revokes child and parent sessions and clears auth state", async () => {
		const auth = new ProtonAuth() as ProtonAuth & {
			session: {
				UID: string;
				AccessToken: string;
				RefreshToken: string;
			} | null;
			parentSession: {
				UID: string;
				AccessToken: string;
				RefreshToken: string;
			} | null;
			pendingAuthResponse: { UID: string } | null;
		};
		auth.session = {
			UID: "child-uid",
			AccessToken: "child-access",
			RefreshToken: "child-refresh",
		};
		auth.parentSession = {
			UID: "parent-uid",
			AccessToken: "parent-access",
			RefreshToken: "parent-refresh",
		};
		auth.pendingAuthResponse = { UID: "pending" };

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
		expect(auth.session).toBeNull();
		expect(auth.parentSession).toBeNull();
		expect(auth.pendingAuthResponse).toBeNull();
	});

	test("logout still clears all session state when revoke requests fail", async () => {
		const auth = new ProtonAuth() as ProtonAuth & {
			session: {
				UID: string;
				AccessToken: string;
				RefreshToken: string;
			} | null;
			parentSession: {
				UID: string;
				AccessToken: string;
				RefreshToken: string;
			} | null;
		};
		auth.session = {
			UID: "child-uid",
			AccessToken: "child-access",
			RefreshToken: "child-refresh",
		};
		auth.parentSession = {
			UID: "parent-uid",
			AccessToken: "parent-access",
			RefreshToken: "parent-refresh",
		};
		requestHttpMock.mockRejectedValueOnce(new Error("network down"));
		requestHttpMock.mockRejectedValueOnce(new Error("still down"));

		await expect(auth.logout()).resolves.toBeUndefined();
		expect(requestHttpMock).toHaveBeenCalledTimes(2);
		expect(auth.session).toBeNull();
		expect(auth.parentSession).toBeNull();
	});
});
