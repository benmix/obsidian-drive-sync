import type { TwoFAInfo } from "@contracts/provider/proton/auth-types";

export type ProtonAuthErrorKind =
	| "two_factor_required"
	| "mailbox_password_required"
	| "session_expired"
	| "invalid_credentials"
	| "invalid_state";

type ProtonAuthErrorInit = {
	message?: string;
	status?: number;
	code?: number;
	twoFactorInfo?: TwoFAInfo;
	cause?: unknown;
};

export class ProtonAuthError extends Error {
	readonly kind: ProtonAuthErrorKind;
	readonly status?: number;
	readonly code?: number;
	readonly twoFactorInfo?: TwoFAInfo;
	readonly requires2FA?: boolean;
	readonly requiresMailboxPassword?: boolean;
	readonly cause?: unknown;

	constructor(kind: ProtonAuthErrorKind, init: ProtonAuthErrorInit = {}) {
		super(init.message ?? defaultMessage(kind));
		this.name = "ProtonAuthError";
		this.kind = kind;
		this.status = init.status;
		this.code = init.code;
		this.twoFactorInfo = init.twoFactorInfo;
		this.requires2FA = kind === "two_factor_required" ? true : undefined;
		this.requiresMailboxPassword = kind === "mailbox_password_required" ? true : undefined;
		this.cause = init.cause;
	}
}

export function createProtonAuthError(
	kind: ProtonAuthErrorKind,
	init: ProtonAuthErrorInit = {},
): ProtonAuthError {
	return new ProtonAuthError(kind, init);
}

export function isProtonAuthError(error: unknown): error is ProtonAuthError {
	return error instanceof ProtonAuthError;
}

function defaultMessage(kind: ProtonAuthErrorKind): string {
	switch (kind) {
		case "two_factor_required":
			return "Two-factor authentication is required.";
		case "mailbox_password_required":
			return "Mailbox password is required.";
		case "session_expired":
			return "Session expired.";
		case "invalid_credentials":
			return "Authentication failed.";
		case "invalid_state":
		default:
			return "Authentication is in an invalid state.";
	}
}
