import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchJsonMock = vi.hoisted(() =>
	vi.fn(async () => ({
		ok: true,
		status: 200,
	})),
);

vi.mock("../../src/provider/providers/proton-drive/sdk/proton-auth/sdk/adapters", () => ({
	createProtonHttpClient: () => ({
		fetchJson: fetchJsonMock,
	}),
}));

vi.mock("../../src/provider/providers/proton-drive/sdk/proton-auth/core/auth-errors", () => ({
	isProtonAuthError: () => false,
}));

vi.mock("../../src/provider/providers/proton-drive/sdk/proton-auth/core/client", () => ({
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

	test("login normalizes mailbox password follow-up failures", async () => {
		const service = new ProtonDriveAuthService() as ProtonDriveAuthService & {
			authClient: {
				login: () => Promise<never>;
				submitMailboxPassword: () => Promise<never>;
			};
			validateSessionWithHttpClient: () => Promise<void>;
		};

		service.authClient = {
			login: async () => {
				const error = new Error("mailbox password required") as Error & {
					requiresMailboxPassword?: boolean;
				};
				error.requiresMailboxPassword = true;
				throw error;
			},
			submitMailboxPassword: async () => {
				const error = new Error("too many requests") as Error & {
					status?: number;
				};
				error.status = 429;
				throw error;
			},
		};
		service.validateSessionWithHttpClient = async () => {};

		await expect(
			service.login({
				username: "user@example.com",
				password: "password",
				mailboxPassword: "mailbox-password",
			}),
		).rejects.toMatchObject({
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
		});
	});

	test("submitTwoFactor normalizes downstream auth failures", async () => {
		const service = new ProtonDriveAuthService() as ProtonDriveAuthService & {
			authClient: {
				submit2FA: () => Promise<never>;
			};
			validateSessionWithHttpClient: () => Promise<void>;
		};

		service.authClient = {
			submit2FA: async () => {
				const error = new Error("unauthorized") as Error & {
					status?: number;
				};
				error.status = 401;
				throw error;
			},
		};
		service.validateSessionWithHttpClient = async () => {};

		await expect(service.submitTwoFactor("123456")).rejects.toMatchObject({
			code: "AUTH_REAUTH_REQUIRED",
			category: "auth",
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
