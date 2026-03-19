import type { PrivateKey } from "openpgp";

// ============================================================================
// Types
// ============================================================================

export interface AuthInfo {
	Version: number;
	Modulus: string;
	ServerEphemeral: string;
	Salt: string;
	SRPSession?: string;
}

export interface Credentials {
	password: string;
}

export interface SrpProofs {
	clientEphemeral: Uint8Array;
	clientProof: Uint8Array;
	expectedServerProof: Uint8Array;
	sharedSession: Uint8Array;
}

export interface SrpResult {
	clientEphemeral: string;
	clientProof: string;
	expectedServerProof: string;
}

export interface AddressKeyInfo {
	ID: string;
	Primary: number;
	armoredKey: string;
	passphrase: string;
}

/**
 * Password mode for Proton accounts:
 * - 1: Single password mode (login password = mailbox password)
 * - 2: Two-password mode (separate login and mailbox passwords)
 */
export type PasswordMode = 1 | 2;

export interface AddressData {
	ID: string;
	Email: string;
	Type: number;
	Status: number;
	keys: AddressKeyInfo[];
}

export interface Session {
	UID: string;
	AccessToken: string;
	RefreshToken: string;
	UserID?: string;
	Scope?: string;
	user?: User;
	keyPassword?: string;
	primaryKey?: PrivateKey;
	addresses?: AddressData[];
	password?: string;
	passwordMode?: PasswordMode;
}

export interface User {
	ID: string;
	Name: string;
	Keys?: UserKey[];
}

export interface UserKey {
	ID: string;
	PrivateKey: string;
}

export interface KeySalt {
	ID: string;
	KeySalt: string;
}

export interface Address {
	ID: string;
	Email: string;
	Type: number;
	Status: number;
	Keys?: AddressKeyData[];
}

export interface AddressKeyData {
	ID: string;
	Primary: number;
	PrivateKey: string;
	Token?: string;
}

export interface ApiError extends Error {
	code?: number;
	status?: number;
	response?: ApiResponse;
	requires2FA?: boolean;
	twoFAInfo?: TwoFAInfo;
	requiresMailboxPassword?: boolean;
}

export interface ApiResponse {
	Code: number;
	Error?: string;
	[key: string]: unknown;
}

export interface TwoFAInfo {
	Enabled: number;
	[key: string]: unknown;
}

export interface AuthResponse extends ApiResponse {
	UID: string;
	AccessToken: string;
	RefreshToken: string;
	UserID: string;
	Scope: string;
	ServerProof: string;
	PasswordMode?: number; // 1 = Single, 2 = Dual (two-password mode)
	"2FA"?: TwoFAInfo;
}

export interface ReusableCredentials {
	// Parent session (from initial login) - used for forking new child sessions
	parentUID: string;
	parentAccessToken: string;
	parentRefreshToken: string;

	// Child session (for API operations) - this is the active working session
	childUID: string;
	childAccessToken: string;
	childRefreshToken: string;

	// Shared credentials
	SaltedKeyPass: string;
	UserID: string;

	// Password mode: 1 = Single, 2 = Two-password mode
	passwordMode: PasswordMode;
}

// ============================================================================
// Session Forking Types
// ============================================================================

export interface ForkEncryptedBlob {
	type: "default";
	keyPassword: string;
}

export interface PushForkResponse extends ApiResponse {
	Selector: string;
}

export interface PullForkResponse extends ApiResponse {
	UID: string;
	AccessToken: string;
	RefreshToken: string;
	ExpiresIn: number;
	TokenType: string;
	UserID: string;
	Scopes: string[];
	LocalID: number;
	Payload: string;
}

// Error code for invalid/expired refresh token
export const INVALID_REFRESH_TOKEN_CODE = 10013;

// ============================================================================
// Constants
// ============================================================================

export const API_BASE_URL = "https://api.protonmail.ch";
export const SRP_LEN = 256; // 2048 / 8, in bytes
export const AUTH_VERSION = 4;
export const BCRYPT_PREFIX = "$2y$10$";
// Linux has no official APP_VERSION, so we masquerade as `macos`
export const PLATFORM_MAP: Record<string, string> = {
	darwin: "macos",
	win32: "windows",
};
export const PLATFORM = PLATFORM_MAP[process.platform] ?? "macos";
export const APP_VERSION = "external-drive-obsidian-drive-sync@0.1.0";
export const CHILD_CLIENT_ID = PLATFORM === "macos" ? "macOSDrive" : "windowsDrive";

// SRP Modulus verification key
export const SRP_MODULUS_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEXAHLgxYJKwYBBAHaRw8BAQdAFurWXXwjTemqjD7CXjXVyKf0of7n9Ctm
L8v9enkzggHNEnByb3RvbkBzcnAubW9kdWx1c8J3BBAWCgApBQJcAcuDBgsJ
BwgDAgkQNQWFxOlRjyYEFQgKAgMWAgECGQECGwMCHgEAAPGRAP9sauJsW12U
MnTQUZpsbJb53d0Wv55mZIIiJL2XulpWPQD/V6NglBd96lZKBmInSXX/kXat
Sv+y0io+LR8i2+jV+AbOOARcAcuDEgorBgEEAZdVAQUBAQdAeJHUz1c9+KfE
kSIgcBRE3WuXC4oj5a2/U3oASExGDW4DAQgHwmEEGBYIABMFAlwBy4MJEDUF
hcTpUY8mAhsMAAD/XQD8DxNI6E78meodQI+wLsrKLeHn32iLvUqJbVDhfWSU
WO4BAMcm1u02t4VKw++ttECPt+HUgPUq5pqQWe5Q2cW4TMsE
=Y4Mw
-----END PGP PUBLIC KEY BLOCK-----`;
