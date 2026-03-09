import type {
	DriveSyncErrorCode,
	ErrorCategory,
	ErrorSeverity,
} from "../contracts/data/error-types";
import type { TranslationParams, Translator } from "../contracts/i18n";

export type { DriveSyncErrorCode, ErrorCategory, ErrorSeverity };

export type DriveSyncErrorInit = {
	category: ErrorCategory;
	severity?: ErrorSeverity;
	retryable?: boolean;
	userMessage?: string;
	userMessageKey?: string;
	userMessageParams?: TranslationParams;
	debugMessage?: string;
	details?: Record<string, unknown>;
	cause?: unknown;
};

export type DriveSyncErrorUserMessage = {
	message: string;
	key?: string;
	params?: TranslationParams;
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
	readonly userMessageKey?: string;
	readonly userMessageParams?: TranslationParams;
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
		this.userMessageKey = init.userMessageKey ?? defaultUserMessageKey(code);
		this.userMessageParams = init.userMessageParams;
		this.debugMessage = init.debugMessage;
		this.details = init.details;
		this.cause = init.cause;
	}
}

type NormalizeOptions = Partial<
	Pick<
		DriveSyncErrorInit,
		| "category"
		| "severity"
		| "retryable"
		| "userMessage"
		| "userMessageKey"
		| "userMessageParams"
		| "debugMessage"
		| "details"
	>
> & {
	code?: DriveSyncErrorCode;
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
	options: NormalizeOptions = {},
): DriveSyncError {
	if (isDriveSyncError(error)) {
		return error;
	}

	const rawMessage =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: (options.debugMessage ?? "Unexpected sync error.");
	const code = options.code ?? "INTERNAL_UNEXPECTED";
	const userMessage = options.userMessage ?? defaultUserMessage(code);

	return new DriveSyncError(code, {
		category: options.category ?? "internal",
		severity: options.severity ?? "error",
		retryable: options.retryable ?? false,
		userMessage,
		userMessageKey: options.userMessageKey ?? defaultUserMessageKey(code),
		userMessageParams: options.userMessageParams,
		debugMessage: rawMessage.trim() || options.debugMessage || defaultUserMessage(code),
		details: options.details,
		cause: error,
	});
}

export function getDriveSyncErrorUserMessage(error: unknown): string {
	const descriptor = getDriveSyncErrorUserMessageDescriptor(error);
	return descriptor.message;
}

export function getDriveSyncErrorUserMessageDescriptor(error: unknown): DriveSyncErrorUserMessage {
	if (isDriveSyncError(error)) {
		return {
			message: error.userMessage,
			key: error.userMessageKey,
			params: error.userMessageParams,
		};
	}
	const normalized = normalizeUnknownDriveSyncError(error);
	return {
		message: normalized.userMessage,
		key: normalized.userMessageKey,
		params: normalized.userMessageParams,
	};
}

export function translateDriveSyncErrorUserMessage(error: unknown, translate: Translator): string {
	const descriptor = getDriveSyncErrorUserMessageDescriptor(error);
	if (descriptor.key) {
		return translate(descriptor.key, descriptor.params);
	}
	return descriptor.message;
}

export function getDriveSyncErrorMessageForCode(
	code: DriveSyncErrorCode | undefined,
	translate: Translator,
	params?: TranslationParams,
): string {
	if (!code) {
		return defaultUserMessage("INTERNAL_UNEXPECTED");
	}
	const key = defaultUserMessageKey(code);
	if (key) {
		return translate(key, params);
	}
	return defaultUserMessage(code);
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

function defaultUserMessageKey(code: DriveSyncErrorCode): string | undefined {
	switch (code) {
		case "AUTH_SESSION_EXPIRED":
			return "error.auth.sessionExpired";
		case "AUTH_REAUTH_REQUIRED":
			return "error.auth.reauthRequired";
		case "AUTH_SIGN_IN_REQUIRED":
			return "error.auth.signInFirst";
		case "AUTH_INVALID_CREDENTIALS":
			return "error.auth.invalidCredentials";
		case "AUTH_2FA_REQUIRED":
			return "error.auth.twoFactorRequired";
		case "AUTH_MAILBOX_PASSWORD_REQUIRED":
			return "error.auth.mailboxPasswordRequired";
		case "NETWORK_TIMEOUT":
			return "error.network.timeout";
		case "NETWORK_RATE_LIMITED":
			return "error.network.rateLimited";
		case "NETWORK_TEMPORARY_FAILURE":
			return "error.network.temporaryFailure";
		case "LOCAL_NOT_FOUND":
			return "error.local.notFound";
		case "REMOTE_NOT_FOUND":
			return "error.remote.notFound";
		case "REMOTE_ALREADY_EXISTS":
		case "REMOTE_PATH_CONFLICT":
			return "error.remote.pathConflict";
		case "REMOTE_UNSUPPORTED":
			return "error.provider.unsupportedOperation";
		case "REMOTE_WRITE_FAILED":
			return "error.remote.writeFailed";
		case "REMOTE_TRANSIENT_INCOMPLETE":
			return "error.remote.transientIncomplete";
		case "PROVIDER_CONNECT_FAILED":
			return "error.provider.unableToConnect";
		case "SYNC_RETRY_EXHAUSTED":
			return "error.sync.retryExhausted";
		case "SYNC_JOB_INVALID":
			return "error.sync.invalidJob";
		case "CONFIG_SCOPE_MISSING":
			return "error.config.scopeMissing";
		case "INTERNAL_UNEXPECTED":
			return "error.internal.unexpected";
		default:
			return undefined;
	}
}

function transientBackoffMs(attempt: number): number {
	return Math.min(1000 * 2 ** Math.max(0, attempt - 1), 60000);
}
