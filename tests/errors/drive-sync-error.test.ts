import { describe, expect, test } from "vitest";

import {
	getDriveSyncErrorUserMessage,
	getRetryDelayForDriveSyncError,
	normalizeUnknownDriveSyncError,
	shouldPauseAuthForError,
	shouldRetryBlockedDriveSyncError,
} from "../../src/errors";

describe("DriveSyncError", () => {
	test("normalizes nested auth/session expiry messages", () => {
		const error = normalizeUnknownDriveSyncError(
			new Error(
				"Failed to restore session: Failed to recover session: Parent session expired. Please re-authenticate.. Please re-authenticate with: proton-drive-sync auth",
			),
		);

		expect(error.code).toBe("AUTH_SESSION_EXPIRED");
		expect(error.category).toBe("auth");
		expect(getDriveSyncErrorUserMessage(error)).toBe(
			"Session expired. Sign in again to continue.",
		);
		expect(shouldPauseAuthForError(error)).toBe(true);
	});

	test("classifies remote path conflicts without treating draft revision as conflict", () => {
		const conflict = normalizeUnknownDriveSyncError(
			new Error("Remote path conflict: folder exists at notes"),
		);
		const draftRevision = normalizeUnknownDriveSyncError(
			new Error("draft revision already exists for this link"),
		);

		expect(conflict.code).toBe("REMOTE_PATH_CONFLICT");
		expect(draftRevision.code).toBe("REMOTE_WRITE_FAILED");
	});

	test("marks incomplete remote payloads as blocked-retry candidates", () => {
		const error = normalizeUnknownDriveSyncError(
			new Error("Session key is missing OpenPGP metadata."),
		);

		expect(error.code).toBe("REMOTE_TRANSIENT_INCOMPLETE");
		expect(error.retryable).toBe(true);
		expect(shouldRetryBlockedDriveSyncError(error)).toBe(true);
	});

	test("uses rate-limit specific retry delays", () => {
		const error = normalizeUnknownDriveSyncError(
			new Error("Too many requests from remote provider"),
		);

		expect(error.code).toBe("NETWORK_RATE_LIMITED");
		expect(getRetryDelayForDriveSyncError(error, 2)).toBe(60000);
	});
});
