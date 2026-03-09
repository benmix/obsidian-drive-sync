export type ErrorCategory =
	| "auth"
	| "network"
	| "local_fs"
	| "remote_fs"
	| "sync"
	| "config"
	| "validation"
	| "provider"
	| "internal";

export type ErrorSeverity = "info" | "warn" | "error" | "fatal";

export type DriveSyncErrorCode =
	| "AUTH_SESSION_EXPIRED"
	| "AUTH_REAUTH_REQUIRED"
	| "AUTH_SIGN_IN_REQUIRED"
	| "AUTH_INVALID_CREDENTIALS"
	| "AUTH_2FA_REQUIRED"
	| "AUTH_MAILBOX_PASSWORD_REQUIRED"
	| "NETWORK_TIMEOUT"
	| "NETWORK_RATE_LIMITED"
	| "NETWORK_TEMPORARY_FAILURE"
	| "LOCAL_NOT_FOUND"
	| "REMOTE_NOT_FOUND"
	| "REMOTE_ALREADY_EXISTS"
	| "REMOTE_PATH_CONFLICT"
	| "REMOTE_UNSUPPORTED"
	| "REMOTE_WRITE_FAILED"
	| "REMOTE_TRANSIENT_INCOMPLETE"
	| "PROVIDER_CONNECT_FAILED"
	| "SYNC_RETRY_EXHAUSTED"
	| "SYNC_JOB_INVALID"
	| "CONFIG_SCOPE_MISSING"
	| "INTERNAL_UNEXPECTED";

export type DriveSyncErrorInit = {
	category: ErrorCategory;
	severity?: ErrorSeverity;
	retryable?: boolean;
	userMessage?: string;
	debugMessage?: string;
	details?: Record<string, unknown>;
	cause?: unknown;
};

export type DriveSyncErrorSummary = {
	code: DriveSyncErrorCode;
	category: ErrorCategory;
	message: string;
	retryable: boolean;
};

export class DriveSyncError extends Error {
	readonly code: DriveSyncErrorCode;
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly retryable: boolean;
	readonly userMessage: string;
	readonly debugMessage?: string;
	readonly details?: Record<string, unknown>;
	readonly cause?: unknown;

	constructor(code: DriveSyncErrorCode, init: DriveSyncErrorInit) {
		const userMessage = init.userMessage ?? defaultUserMessage(code);
		super(init.debugMessage ?? userMessage);
		this.name = "DriveSyncError";
		this.code = code;
		this.category = init.category;
		this.severity = init.severity ?? "error";
		this.retryable = init.retryable ?? false;
		this.userMessage = userMessage;
		this.debugMessage = init.debugMessage;
		this.details = init.details;
		this.cause = init.cause;
	}
}

type NormalizeFallback = Partial<
	Pick<
		DriveSyncErrorInit,
		"category" | "severity" | "retryable" | "userMessage" | "debugMessage" | "details"
	>
> & {
	code?: DriveSyncErrorCode;
};

type LegacyClassification = {
	code: DriveSyncErrorCode;
	category: ErrorCategory;
	retryable?: boolean;
	userMessage?: string;
};

export function createDriveSyncError(
	code: DriveSyncErrorCode,
	init: DriveSyncErrorInit,
): DriveSyncError {
	return new DriveSyncError(code, init);
}

export function isDriveSyncError(error: unknown): error is DriveSyncError {
	return error instanceof DriveSyncError;
}

export function normalizeUnknownDriveSyncError(
	error: unknown,
	fallback: NormalizeFallback = {},
): DriveSyncError {
	if (isDriveSyncError(error)) {
		return error;
	}

	const rawMessage =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: (fallback.debugMessage ?? "Unexpected sync error.");
	const classified = classifyLegacyError(rawMessage);
	const code = classified?.code ?? fallback.code ?? "INTERNAL_UNEXPECTED";
	const userMessage =
		classified?.userMessage ??
		fallback.userMessage ??
		(rawMessage.trim() || defaultUserMessage(code));

	return new DriveSyncError(code, {
		category: classified?.category ?? fallback.category ?? "internal",
		severity: fallback.severity ?? "error",
		retryable: classified?.retryable ?? fallback.retryable ?? false,
		userMessage,
		debugMessage: rawMessage.trim() || fallback.debugMessage || defaultUserMessage(code),
		details: fallback.details,
		cause: error,
	});
}

export function getDriveSyncErrorUserMessage(error: unknown, fallback?: string): string {
	if (isDriveSyncError(error)) {
		return error.userMessage;
	}
	const normalized = normalizeUnknownDriveSyncError(error, {
		userMessage: fallback,
	});
	return normalized.userMessage;
}

export function toDriveSyncErrorSummary(error: unknown): DriveSyncErrorSummary {
	const normalized = normalizeUnknownDriveSyncError(error);
	return {
		code: normalized.code,
		category: normalized.category,
		message: normalized.userMessage,
		retryable: normalized.retryable,
	};
}

export function formatDriveSyncErrorForLog(error: unknown): string {
	const normalized = normalizeUnknownDriveSyncError(error);
	const debugMessage = normalized.debugMessage ?? normalized.userMessage;
	return `${normalized.code}: ${debugMessage}`;
}

export function isAuthDriveSyncError(error: unknown): boolean {
	return normalizeUnknownDriveSyncError(error).category === "auth";
}

export function isAuthDriveSyncErrorCode(code?: DriveSyncErrorCode): boolean {
	return Boolean(code && code.startsWith("AUTH_"));
}

export function isNotFoundDriveSyncError(error: unknown): boolean {
	const code = normalizeUnknownDriveSyncError(error).code;
	return code === "LOCAL_NOT_FOUND" || code === "REMOTE_NOT_FOUND";
}

export function isPathConflictDriveSyncError(error: unknown): boolean {
	const code = normalizeUnknownDriveSyncError(error).code;
	return code === "REMOTE_ALREADY_EXISTS" || code === "REMOTE_PATH_CONFLICT";
}

export function shouldPauseAuthForError(error: unknown): boolean {
	return isAuthDriveSyncError(error);
}

export function shouldRetryBlockedDriveSyncError(error: unknown): boolean {
	return normalizeUnknownDriveSyncError(error).code === "REMOTE_TRANSIENT_INCOMPLETE";
}

export function shouldRetryBlockedDriveSyncErrorCode(code?: DriveSyncErrorCode): boolean {
	return code === "REMOTE_TRANSIENT_INCOMPLETE";
}

export function getRetryDelayForDriveSyncError(error: unknown, attempt: number): number {
	const normalized = normalizeUnknownDriveSyncError(error);
	switch (normalized.code) {
		case "REMOTE_NOT_FOUND":
		case "LOCAL_NOT_FOUND":
			return Math.min(10000 * attempt, 60000);
		case "NETWORK_RATE_LIMITED":
			return Math.min(30000 * attempt, 300000);
		case "NETWORK_TIMEOUT":
		case "NETWORK_TEMPORARY_FAILURE":
		case "REMOTE_TRANSIENT_INCOMPLETE":
			return transientBackoffMs(attempt);
		default:
			return Math.min(5000 * attempt, 60000);
	}
}

function classifyLegacyError(message: string): LegacyClassification | null {
	const normalized = message.toLowerCase().trim();
	if (!normalized) {
		return null;
	}

	if (
		normalized.includes("session key is missing openpgp metadata") ||
		normalized.includes("missing block file")
	) {
		return {
			code: "REMOTE_TRANSIENT_INCOMPLETE",
			category: "remote_fs",
			retryable: true,
			userMessage: "Remote data is not ready yet. The sync will retry automatically.",
		};
	}

	if (normalized.includes("draft revision already exists for this link")) {
		return {
			code: "REMOTE_WRITE_FAILED",
			category: "remote_fs",
			retryable: true,
			userMessage: "Remote write was rejected. The sync will retry automatically.",
		};
	}

	if (
		normalized.includes("two-factor authentication is required") ||
		normalized.includes("2fa required") ||
		normalized.includes("two-factor")
	) {
		return {
			code: "AUTH_2FA_REQUIRED",
			category: "auth",
			userMessage: "Two-factor authentication is required.",
		};
	}

	if (normalized.includes("mailbox password is required")) {
		return {
			code: "AUTH_MAILBOX_PASSWORD_REQUIRED",
			category: "auth",
			userMessage: "Mailbox password is required for this account.",
		};
	}

	if (
		normalized.includes("sign in to ") &&
		normalized.includes(" first") &&
		!normalized.includes("signed in")
	) {
		return {
			code: "AUTH_SIGN_IN_REQUIRED",
			category: "auth",
		};
	}

	if (
		normalized.includes("invalid_refresh_token") ||
		normalized.includes("invalid refresh token") ||
		normalized.includes("parent session expired") ||
		normalized.includes("session expired") ||
		normalized.includes("re-authenticate")
	) {
		return {
			code: "AUTH_SESSION_EXPIRED",
			category: "auth",
			userMessage: "Session expired. Sign in again to continue.",
		};
	}

	if (
		normalized.includes("unauthorized") ||
		normalized.includes("forbidden") ||
		normalized.includes("authentication failed") ||
		normalized.includes("login failed") ||
		normalized.includes("token refresh failed")
	) {
		return {
			code: "AUTH_REAUTH_REQUIRED",
			category: "auth",
			userMessage: "Authentication required. Sign in again to continue.",
		};
	}

	if (
		normalized.includes("invalid credentials") ||
		normalized.includes("server proof verification failed") ||
		normalized.includes("unable to verify server identity")
	) {
		return {
			code: "AUTH_INVALID_CREDENTIALS",
			category: "auth",
			userMessage: "Authentication failed. Check your credentials and try again.",
		};
	}

	if (normalized.includes("not found") || normalized.includes("404")) {
		return {
			code:
				normalized.includes("local") || normalized.includes("missing file")
					? "LOCAL_NOT_FOUND"
					: "REMOTE_NOT_FOUND",
			category:
				normalized.includes("local") || normalized.includes("missing file")
					? "local_fs"
					: "remote_fs",
		};
	}

	if (normalized.includes("missing file") || normalized.includes("missing path")) {
		return {
			code: "LOCAL_NOT_FOUND",
			category: "local_fs",
		};
	}

	if (normalized.includes("remote path conflict")) {
		return {
			code: "REMOTE_PATH_CONFLICT",
			category: "remote_fs",
			userMessage: "Remote path conflict detected.",
		};
	}

	if (
		normalized.includes("already exists") ||
		normalized.includes("file or folder with that name already exists")
	) {
		return {
			code: "REMOTE_ALREADY_EXISTS",
			category: "remote_fs",
			userMessage: "Remote path conflict detected.",
		};
	}

	if (
		normalized.includes("too many") ||
		normalized.includes("rate limit") ||
		normalized.includes("rate-limited") ||
		normalized.includes("throttle")
	) {
		return {
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
			userMessage:
				"Remote provider rate limited requests. The sync will retry automatically.",
		};
	}

	if (normalized.includes("timeout")) {
		return {
			code: "NETWORK_TIMEOUT",
			category: "network",
			retryable: true,
			userMessage: "Network request timed out. The sync will retry automatically.",
		};
	}

	if (
		normalized.includes("network") ||
		normalized.includes("temporar") ||
		normalized.includes("503") ||
		normalized.includes("500") ||
		normalized.includes("failed to fetch")
	) {
		return {
			code: "NETWORK_TEMPORARY_FAILURE",
			category: "network",
			retryable: true,
			userMessage: "Temporary network failure. The sync will retry automatically.",
		};
	}

	if (
		normalized.includes("does not expose") ||
		normalized.includes("not supported") ||
		normalized.includes("unsupported")
	) {
		return {
			code: "REMOTE_UNSUPPORTED",
			category: "provider",
			userMessage: "This remote operation is not supported.",
		};
	}

	if (normalized.includes("unable to connect to ")) {
		return {
			code: "PROVIDER_CONNECT_FAILED",
			category: "provider",
		};
	}

	return null;
}

function defaultUserMessage(code: DriveSyncErrorCode): string {
	switch (code) {
		case "AUTH_SESSION_EXPIRED":
			return "Session expired. Sign in again to continue.";
		case "AUTH_REAUTH_REQUIRED":
			return "Authentication required. Sign in again to continue.";
		case "AUTH_SIGN_IN_REQUIRED":
			return "Sign in first.";
		case "AUTH_INVALID_CREDENTIALS":
			return "Authentication failed. Check your credentials and try again.";
		case "AUTH_2FA_REQUIRED":
			return "Two-factor authentication is required.";
		case "AUTH_MAILBOX_PASSWORD_REQUIRED":
			return "Mailbox password is required for this account.";
		case "NETWORK_TIMEOUT":
			return "Network request timed out. The sync will retry automatically.";
		case "NETWORK_RATE_LIMITED":
			return "Remote provider rate limited requests. The sync will retry automatically.";
		case "NETWORK_TEMPORARY_FAILURE":
			return "Temporary network failure. The sync will retry automatically.";
		case "LOCAL_NOT_FOUND":
			return "Local item not found.";
		case "REMOTE_NOT_FOUND":
			return "Remote item not found.";
		case "REMOTE_ALREADY_EXISTS":
		case "REMOTE_PATH_CONFLICT":
			return "Remote path conflict detected.";
		case "REMOTE_UNSUPPORTED":
			return "This remote operation is not supported.";
		case "REMOTE_WRITE_FAILED":
			return "Remote write failed.";
		case "REMOTE_TRANSIENT_INCOMPLETE":
			return "Remote data is not ready yet. The sync will retry automatically.";
		case "PROVIDER_CONNECT_FAILED":
			return "Unable to connect to the remote provider.";
		case "SYNC_RETRY_EXHAUSTED":
			return "Sync retries exhausted.";
		case "SYNC_JOB_INVALID":
			return "Sync job is invalid.";
		case "CONFIG_SCOPE_MISSING":
			return "Select a remote folder first.";
		case "INTERNAL_UNEXPECTED":
		default:
			return "Unexpected sync error.";
	}
}

function transientBackoffMs(attempt: number): number {
	return Math.min(1000 * 2 ** Math.max(0, attempt - 1), 60000);
}
