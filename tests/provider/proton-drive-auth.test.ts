import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchJsonMock = vi.hoisted(() =>
	vi.fn(async () => ({
		ok: true,
		status: 200,
	})),
);

vi.mock("../../src/provider/providers/proton-drive/sdk/proton-auth/sdk-helpers", () => ({
	createProtonHttpClient: () => ({
		fetchJson: fetchJsonMock,
	}),
}));

vi.mock("../../src/provider/providers/proton-drive/sdk/proton-auth/core", () => ({
	ProtonAuth: class {},
}));

import { ProtonDriveAuthService } from "../../src/provider/providers/proton-drive/sdk/auth";

describe("ProtonDriveAuthService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		fetchJsonMock.mockReset();
		fetchJsonMock.mockResolvedValue({
			ok: true,
			status: 200,
		});
	});

	test("restore maps invalid refresh token code to AUTH_SESSION_EXPIRED", async () => {
		const service = new ProtonDriveAuthService() as ProtonDriveAuthService & {
			authClient: {
				restoreSession: () => Promise<never>;
			};
			validateSessionWithHttpClient: () => Promise<void>;
		};

		service.authClient = {
			restoreSession: async () => {
				const error = new Error("raw sdk message") as Error & {
					code?: number;
				};
				error.code = 10013;
				throw error;
			},
		};
		service.validateSessionWithHttpClient = async () => {};

		await expect(service.restore({} as never)).rejects.toMatchObject({
			code: "AUTH_SESSION_EXPIRED",
			category: "auth",
		});
	});

	test("refreshToken maps http status 429 to NETWORK_RATE_LIMITED", async () => {
		const service = new ProtonDriveAuthService() as ProtonDriveAuthService & {
			authClient: {
				refreshTokenWithForkRecovery: () => Promise<never>;
			};
			validateSessionWithHttpClient: () => Promise<void>;
		};

		service.authClient = {
			refreshTokenWithForkRecovery: async () => {
				const error = new Error("raw sdk message") as Error & {
					status?: number;
				};
				error.status = 429;
				throw error;
			},
		};
		service.validateSessionWithHttpClient = async () => {};

		await expect(service.refreshToken()).rejects.toMatchObject({
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
		});
	});

	test("validateSessionWithHttpClient maps abort errors to NETWORK_TIMEOUT", async () => {
		const service = new ProtonDriveAuthService() as ProtonDriveAuthService & {
			validateSessionWithHttpClient: (session: {
				UID: string;
				AccessToken: string;
				RefreshToken: string;
			}) => Promise<void>;
		};
		const error = new Error("Request timed out after 15000ms.");
		error.name = "AbortError";
		fetchJsonMock.mockRejectedValueOnce(error);

		await expect(
			service.validateSessionWithHttpClient({
				UID: "uid-1",
				AccessToken: "access-1",
				RefreshToken: "refresh-1",
			}),
		).rejects.toMatchObject({
			code: "NETWORK_TIMEOUT",
			category: "network",
			retryable: true,
		});
	});

	test("validateSessionWithHttpClient maps transport failures to NETWORK_TEMPORARY_FAILURE", async () => {
		const service = new ProtonDriveAuthService() as ProtonDriveAuthService & {
			validateSessionWithHttpClient: (session: {
				UID: string;
				AccessToken: string;
				RefreshToken: string;
			}) => Promise<void>;
		};
		fetchJsonMock.mockRejectedValueOnce(new Error("Failed to fetch"));

		await expect(
			service.validateSessionWithHttpClient({
				UID: "uid-1",
				AccessToken: "access-1",
				RefreshToken: "refresh-1",
			}),
		).rejects.toMatchObject({
			code: "NETWORK_TEMPORARY_FAILURE",
			category: "network",
			retryable: true,
		});
	});
});
