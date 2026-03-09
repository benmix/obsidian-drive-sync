import { describe, expect, test } from "vitest";

import {
	createDriveSyncError,
	getDriveSyncErrorMessageForCode,
	getDriveSyncErrorUserMessage,
	getDriveSyncErrorUserMessageDescriptor,
	getRetryDelayForDriveSyncError,
	normalizeUnknownDriveSyncError,
	shouldPauseAuthForError,
	shouldRetryBlockedDriveSyncError,
	translateDriveSyncErrorUserMessage,
} from "../../src/errors";

describe("DriveSyncError", () => {
	test("normalizes nested auth/session expiry messages", () => {
		const error = normalizeUnknownDriveSyncError(new Error("unexpected"), {
			code: "AUTH_SESSION_EXPIRED",
			category: "auth",
		});

		expect(error.code).toBe("AUTH_SESSION_EXPIRED");
		expect(error.category).toBe("auth");
		expect(getDriveSyncErrorUserMessage(error)).toBe(
			"Session expired. Sign in again to continue.",
		);
		expect(shouldPauseAuthForError(error)).toBe(true);
	});

	test("defaults unknown raw errors to internal unexpected", () => {
		const error = normalizeUnknownDriveSyncError(new Error("some sdk message"));

		expect(error.code).toBe("INTERNAL_UNEXPECTED");
		expect(error.category).toBe("internal");
		expect(getDriveSyncErrorUserMessage(error)).toBe("Unexpected sync error.");
	});

	test("marks incomplete remote payloads as blocked-retry candidates", () => {
		const error = normalizeUnknownDriveSyncError(new Error("unexpected"), {
			code: "REMOTE_TRANSIENT_INCOMPLETE",
			category: "remote_fs",
			retryable: true,
		});

		expect(error.code).toBe("REMOTE_TRANSIENT_INCOMPLETE");
		expect(error.retryable).toBe(true);
		expect(shouldRetryBlockedDriveSyncError(error)).toBe(true);
	});

	test("uses rate-limit specific retry delays", () => {
		const error = normalizeUnknownDriveSyncError(new Error("unexpected"), {
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
		});

		expect(error.code).toBe("NETWORK_RATE_LIMITED");
		expect(getRetryDelayForDriveSyncError(error, 2)).toBe(60000);
	});

	test("exposes user message descriptor and translates from key", () => {
		const error = createDriveSyncError("AUTH_SIGN_IN_REQUIRED", {
			category: "auth",
			userMessage: "Sign in to Proton Drive first.",
			userMessageKey: "error.auth.signInToProviderFirst",
			userMessageParams: { provider: "Proton Drive" },
		});
		const translate = (key: string, params?: Record<string, unknown>) =>
			`${key}:${String(params?.provider ?? "")}`;

		expect(getDriveSyncErrorUserMessageDescriptor(error)).toEqual({
			message: "Sign in to Proton Drive first.",
			key: "error.auth.signInToProviderFirst",
			params: { provider: "Proton Drive" },
		});
		expect(translateDriveSyncErrorUserMessage(error, translate)).toBe(
			"error.auth.signInToProviderFirst:Proton Drive",
		);
		expect(getDriveSyncErrorMessageForCode("REMOTE_PATH_CONFLICT", translate)).toBe(
			"error.remote.pathConflict:",
		);
	});
});
