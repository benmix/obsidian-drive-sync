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
