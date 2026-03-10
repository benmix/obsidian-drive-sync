import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../src/provider/providers/proton-drive/sdk/proton-auth/sdk-helpers", () => ({
	createProtonHttpClient: () => ({
		fetchJson: async () => ({
			ok: true,
			status: 200,
		}),
	}),
}));

vi.mock("../../src/provider/providers/proton-drive/sdk/proton-auth/core", () => ({
	ProtonAuth: class {},
}));

import { ProtonDriveAuthService } from "../../src/provider/providers/proton-drive/sdk/auth";

describe("ProtonDriveAuthService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
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
});
