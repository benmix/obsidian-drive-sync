import { beforeEach, describe, expect, test, vi } from "vitest";

const requestHttpMock = vi.hoisted(() => vi.fn());

vi.mock("@provider/providers/proton-drive/transport/http", () => ({
	requestHttp: requestHttpMock,
}));

import { createProtonAccount } from "@provider/providers/proton-drive/sdk/account";
import { createProtonHttpClient } from "@provider/providers/proton-drive/sdk/http-client";

describe("createProtonHttpClient", () => {
	beforeEach(() => {
		requestHttpMock.mockReset();
	});

	test("retries once after token refresh and reuses updated auth headers", async () => {
		const session = {
			UID: "uid-1",
			AccessToken: "access-1",
			RefreshToken: "refresh-1",
		};
		const onTokenRefresh = vi.fn(async () => {
			session.AccessToken = "access-2";
		});
		const headerSnapshots: string[] = [];
		requestHttpMock.mockImplementation(async (_url: string, options: { headers: Headers }) => {
			headerSnapshots.push(options.headers.get("Authorization") ?? "");
			return new Response(null, {
				status: headerSnapshots.length === 1 ? 401 : 200,
			});
		});
		const client = createProtonHttpClient(session, onTokenRefresh);

		const response = await client.fetchJson({
			url: "core/v4/users",
			method: "GET",
			headers: new Headers(),
			timeoutMs: 15000,
		});

		expect(response.status).toBe(200);
		expect(onTokenRefresh).toHaveBeenCalledTimes(1);
		expect(requestHttpMock).toHaveBeenCalledTimes(2);
		expect(requestHttpMock.mock.calls[0]?.[0]).toBe("https://api.protonmail.ch/core/v4/users");
		expect(requestHttpMock.mock.calls[1]?.[0]).toBe("https://api.protonmail.ch/core/v4/users");
		expect(headerSnapshots).toEqual(["Bearer access-1", "Bearer access-2"]);
	});

	test("returns the original 401 response when refresh fails", async () => {
		const session = {
			UID: "uid-1",
			AccessToken: "access-1",
			RefreshToken: "refresh-1",
		};
		const onTokenRefresh = vi.fn(async () => {
			throw new Error("refresh failed");
		});
		requestHttpMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
		const client = createProtonHttpClient(session, onTokenRefresh);

		const response = await client.fetchBlob({
			url: "https://example.test/blob",
			method: "GET",
			headers: new Headers(),
			timeoutMs: 3000,
		});

		expect(response.status).toBe(401);
		expect(onTokenRefresh).toHaveBeenCalledTimes(1);
		expect(requestHttpMock).toHaveBeenCalledTimes(1);
	});

	test("reads the latest session from a getter after refresh", async () => {
		let session = {
			UID: "uid-1",
			AccessToken: "access-1",
			RefreshToken: "refresh-1",
		};
		const headerSnapshots: string[] = [];
		const onTokenRefresh = vi.fn(async () => {
			session = {
				...session,
				AccessToken: "access-2",
				RefreshToken: "refresh-2",
			};
		});
		requestHttpMock.mockImplementation(async (_url: string, options: { headers: Headers }) => {
			headerSnapshots.push(options.headers.get("Authorization") ?? "");
			return new Response(null, {
				status: headerSnapshots.length === 1 ? 401 : 200,
			});
		});
		const client = createProtonHttpClient(() => session, onTokenRefresh);

		const response = await client.fetchJson({
			url: "core/v4/users",
			method: "GET",
			headers: new Headers(),
			timeoutMs: 2000,
		});

		expect(response.status).toBe(200);
		expect(onTokenRefresh).toHaveBeenCalledTimes(1);
		expect(headerSnapshots).toEqual(["Bearer access-1", "Bearer access-2"]);
	});

	test("forwards both timeoutMs and signal to requestHttp", async () => {
		const session = {
			UID: "uid-1",
			AccessToken: "access-1",
			RefreshToken: "refresh-1",
		};
		const signal = new AbortController().signal;
		requestHttpMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
		const client = createProtonHttpClient(session);

		await client.fetchJson({
			url: "core/v4/users",
			method: "GET",
			headers: new Headers(),
			timeoutMs: 1234,
			signal,
		});

		expect(requestHttpMock).toHaveBeenCalledWith(
			"https://api.protonmail.ch/core/v4/users",
			expect.objectContaining({
				timeoutMs: 1234,
				signal,
			}),
			"json",
		);
	});

	test("reads updated addresses from the latest session getter", async () => {
		let session = {
			UID: "uid-1",
			AccessToken: "access-1",
			RefreshToken: "refresh-1",
			addresses: [
				{
					ID: "addr-1",
					Email: "old@example.com",
					Type: 1,
					Status: 1,
					keys: [
						{
							ID: "key-1",
							Primary: 1,
							armoredKey: "old-key",
							passphrase: "pass-1",
						},
					],
				},
			],
		};
		const cryptoModule = {
			decryptKey: vi.fn(async () => ({
				getFingerprint: () => "fingerprint-new",
			})),
		};
		const account = createProtonAccount(() => session, cryptoModule as never);

		session = {
			...session,
			addresses: [
				{
					ID: "addr-2",
					Email: "new@example.com",
					Type: 1,
					Status: 1,
					keys: [
						{
							ID: "key-2",
							Primary: 1,
							armoredKey: "new-key",
							passphrase: "pass-2",
						},
					],
				},
			],
		};

		const primaryAddress = await account.getOwnPrimaryAddress();

		expect(primaryAddress.email).toBe("new@example.com");
		expect(primaryAddress.addressId).toBe("addr-2");
		expect(cryptoModule.decryptKey).toHaveBeenCalledWith("new-key", "pass-2");
	});
});
