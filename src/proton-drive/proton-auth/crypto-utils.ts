import bcrypt from "bcryptjs";
import type { ForkEncryptedBlob } from "./types";
import { BCRYPT_PREFIX } from "./types";

// ============================================================================
// BigInt Utilities
// ============================================================================

/**
 * Convert Uint8Array to BigInt (little-endian)
 */
export function uint8ArrayToBigIntLE(arr: Uint8Array): bigint {
	let result = 0n;
	for (let i = arr.length - 1; i >= 0; i--) {
		const value = arr[arr.length - 1 - i];
		if (value === undefined) {
			throw new Error("Invalid byte array access");
		}
		result = (result << 8n) | BigInt(value);
	}
	return result;
}

/**
 * Convert BigInt to Uint8Array (little-endian)
 */
export function bigIntToUint8ArrayLE(num: bigint, length: number): Uint8Array {
	const result = new Uint8Array(length);
	let temp = num;
	for (let i = 0; i < length; i++) {
		result[i] = Number(temp & 0xffn);
		temp >>= 8n;
	}
	return result;
}

/**
 * Get byte length of a BigInt
 */
export function bigIntByteLength(num: bigint): number {
	if (num === 0n) return 1;
	let length = 0;
	let temp = num;
	while (temp > 0n) {
		temp >>= 8n;
		length++;
	}
	return length;
}

/**
 * Modular exponentiation: (base^exp) mod modulus
 */
export function modExp(base: bigint, exp: bigint, modulus: bigint): bigint {
	if (modulus === 1n) return 0n;
	let result = 1n;
	base = base % modulus;
	while (exp > 0n) {
		if (exp % 2n === 1n) {
			result = (result * base) % modulus;
		}
		exp = exp >> 1n;
		base = (base * base) % modulus;
	}
	return result;
}

/**
 * Modulo operation that handles negative numbers correctly
 */
export function mod(n: bigint, m: bigint): bigint {
	return ((n % m) + m) % m;
}

// ============================================================================
// Crypto Utilities
// ============================================================================

/**
 * Compute SHA-512 hash
 */
export async function sha512(data: Uint8Array): Promise<Uint8Array> {
	// Create a new ArrayBuffer copy to satisfy TypeScript's strict typing
	const buffer = await crypto.subtle.digest("SHA-512", new Uint8Array(data));
	return new Uint8Array(buffer);
}

/**
 * Expand hash using SHA-512 (concatenating 4 hashes with indices)
 */
export async function expandHash(input: Uint8Array): Promise<Uint8Array> {
	const hashes = await Promise.all(
		[0, 1, 2, 3].map(async (i) => {
			const combined = new Uint8Array(input.length + 1);
			combined.set(input);
			combined[input.length] = i;
			return sha512(combined);
		}),
	);
	const result = new Uint8Array(hashes.reduce((acc, h) => acc + h.length, 0));
	let offset = 0;
	for (const hash of hashes) {
		result.set(hash, offset);
		offset += hash.length;
	}
	return result;
}

/**
 * Base64 encode Uint8Array
 */
export function base64Encode(arr: Uint8Array): string {
	return btoa(String.fromCharCode(...arr));
}

/**
 * Base64 decode to Uint8Array
 */
export function base64Decode(str: string): Uint8Array {
	const binaryStr = atob(str);
	const arr = new Uint8Array(binaryStr.length);
	for (let i = 0; i < binaryStr.length; i++) {
		arr[i] = binaryStr.charCodeAt(i);
	}
	return arr;
}

/**
 * Convert string to Uint8Array (UTF-8 encoding)
 */
export function stringToUint8Array(str: string): Uint8Array {
	return new TextEncoder().encode(str);
}

/**
 * Convert binary string to Uint8Array (treats each char as a byte value)
 * This is different from stringToUint8Array which uses UTF-8 encoding
 */
export function binaryStringToArray(str: string): Uint8Array {
	const result = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++) {
		result[i] = str.charCodeAt(i);
	}
	return result;
}

/**
 * Convert Uint8Array to binary string
 */
export function uint8ArrayToBinaryString(arr: Uint8Array): string {
	return String.fromCharCode(...arr);
}

/**
 * Merge multiple Uint8Arrays
 */
export function mergeUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

// ============================================================================
// AES-GCM Encryption for Session Forking
// ============================================================================

const FORK_PAYLOAD_IV_LENGTH = 16; // Proton uses non-standard 16-byte IV
const FORK_PAYLOAD_KEY_LENGTH = 32; // AES-256
const FORK_PAYLOAD_AAD = "fork"; // Additional authenticated data for v2

/**
 * Import raw bytes as AES-GCM key
 */
export async function importAesGcmKey(rawKey: Uint8Array): Promise<CryptoKey> {
	// Create a new ArrayBuffer copy to satisfy TypeScript's strict typing
	const keyBuffer = new Uint8Array(rawKey).buffer as ArrayBuffer;
	return crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, [
		"encrypt",
		"decrypt",
	]);
}

/**
 * Encrypt fork payload using AES-256-GCM with 16-byte IV
 * Matches Proton's encryptDataWith16ByteIV format
 */
export async function encryptForkPayload(
	key: CryptoKey,
	data: string,
	additionalData?: Uint8Array,
): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(FORK_PAYLOAD_IV_LENGTH));
	const encodedData = stringToUint8Array(data);

	// Create new ArrayBuffer copies to satisfy TypeScript's strict typing
	const ivBuffer = new Uint8Array(iv);
	const dataBuffer = new Uint8Array(encodedData);
	const aadBuffer = additionalData ? new Uint8Array(additionalData) : undefined;

	const ciphertext = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: ivBuffer,
			...(aadBuffer !== undefined ? { additionalData: aadBuffer } : {}),
		},
		key,
		dataBuffer,
	);

	// Format: [16-byte IV][ciphertext + auth tag]
	const result = mergeUint8Arrays([iv, new Uint8Array(ciphertext)]);
	return base64Encode(result);
}

/**
 * Decrypt fork payload using AES-256-GCM with 16-byte IV
 */
export async function decryptForkPayload(
	key: CryptoKey,
	blob: string,
	additionalData?: Uint8Array,
): Promise<string> {
	const data = base64Decode(blob);

	// Extract IV (first 16 bytes) and ciphertext
	const iv = data.slice(0, FORK_PAYLOAD_IV_LENGTH);
	const ciphertext = data.slice(FORK_PAYLOAD_IV_LENGTH);

	// Create new ArrayBuffer copies to satisfy TypeScript's strict typing
	const ivBuffer = new Uint8Array(iv);
	const ciphertextBuffer = new Uint8Array(ciphertext);
	const aadBuffer = additionalData ? new Uint8Array(additionalData) : undefined;

	const decrypted = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv: ivBuffer,
			...(aadBuffer !== undefined ? { additionalData: aadBuffer } : {}),
		},
		key,
		ciphertextBuffer,
	);

	return new TextDecoder().decode(decrypted);
}

/**
 * Create encrypted fork blob containing keyPassword
 */
export async function createForkEncryptedBlob(
	keyPassword: string,
): Promise<{ key: Uint8Array; blob: string }> {
	// Generate random 32-byte key
	const rawKey = crypto.getRandomValues(new Uint8Array(FORK_PAYLOAD_KEY_LENGTH));
	const cryptoKey = await importAesGcmKey(rawKey);

	// Create payload matching Proton's ForkEncryptedBlob format
	const payload: ForkEncryptedBlob = {
		type: "default",
		keyPassword,
	};

	// Encrypt with AAD for payload version 2
	const aad = stringToUint8Array(FORK_PAYLOAD_AAD);
	const blob = await encryptForkPayload(cryptoKey, JSON.stringify(payload), aad);

	return { key: rawKey, blob };
}

/**
 * Decrypt fork blob to extract keyPassword
 */
export async function decryptForkEncryptedBlob(key: Uint8Array, blob: string): Promise<string> {
	const cryptoKey = await importAesGcmKey(key);
	const aad = stringToUint8Array(FORK_PAYLOAD_AAD);

	const decrypted = await decryptForkPayload(cryptoKey, blob, aad);
	const payload: ForkEncryptedBlob = JSON.parse(decrypted);

	return payload.keyPassword;
}

// ============================================================================
// bcrypt Utilities
// ============================================================================

/**
 * Custom bcrypt base64 encoding (uses ./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789)
 */
export function bcryptEncodeBase64(data: Uint8Array, length: number): string {
	const BCRYPT_CHARS = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	let off = 0;
	let c1: number, c2: number;

	while (off < length) {
		const byte1 = data[off++];
		if (byte1 === undefined) {
			throw new Error("Invalid byte array access");
		}
		c1 = byte1 & 0xff;
		result += BCRYPT_CHARS[(c1 >> 2) & 0x3f];
		c1 = (c1 & 0x03) << 4;
		if (off >= length) {
			result += BCRYPT_CHARS[c1 & 0x3f];
			break;
		}
		const byte2 = data[off++];
		if (byte2 === undefined) {
			throw new Error("Invalid byte array access");
		}
		c2 = byte2 & 0xff;
		c1 |= (c2 >> 4) & 0x0f;
		result += BCRYPT_CHARS[c1 & 0x3f];
		c1 = (c2 & 0x0f) << 2;
		if (off >= length) {
			result += BCRYPT_CHARS[c1 & 0x3f];
			break;
		}
		const byte3 = data[off++];
		if (byte3 === undefined) {
			throw new Error("Invalid byte array access");
		}
		c2 = byte3 & 0xff;
		c1 |= (c2 >> 6) & 0x03;
		result += BCRYPT_CHARS[c1 & 0x3f];
		result += BCRYPT_CHARS[c2 & 0x3f];
	}
	return result;
}

// ============================================================================
// Password Hashing
// ============================================================================

interface HashPasswordParams {
	password: string;
	salt?: string;
	modulus: Uint8Array;
	version: number;
}

/**
 * Hash password using bcrypt and expand with SHA-512
 */
export async function formatHash(
	password: string,
	salt: string,
	modulus: Uint8Array,
): Promise<Uint8Array> {
	const hash = bcrypt.hashSync(password, BCRYPT_PREFIX + salt);
	const hashBytes = stringToUint8Array(hash);
	return expandHash(mergeUint8Arrays([hashBytes, modulus]));
}

/**
 * Hash password for auth version 3+
 */
export async function hashPasswordV3(
	password: string,
	salt: string,
	modulus: Uint8Array,
): Promise<Uint8Array> {
	// salt is a binary string (from base64 decode), so we must use binaryStringToArray
	// not stringToUint8Array (which would UTF-8 encode and corrupt bytes > 127)
	const saltBinary = binaryStringToArray(salt + "proton");
	const bcryptSalt = bcryptEncodeBase64(saltBinary, 16);
	return formatHash(password, bcryptSalt, modulus);
}

/**
 * Hash password based on auth version
 */
export async function hashPassword({
	password,
	salt,
	modulus,
	version,
}: HashPasswordParams): Promise<Uint8Array> {
	if (version >= 3) {
		if (!salt) throw new Error("Missing salt for auth version >= 3");
		return hashPasswordV3(password, salt, modulus);
	}
	throw new Error(`Unsupported auth version: ${version}`);
}

/**
 * Compute key password from password and salt using bcrypt
 */
export async function computeKeyPassword(password: string, salt: string): Promise<string> {
	if (!password || !salt || salt.length !== 24 || password.length < 1) {
		throw new Error("Password and salt required.");
	}
	const saltBinary = base64Decode(salt);
	const bcryptSalt = bcryptEncodeBase64(saltBinary, 16);
	const hash = bcrypt.hashSync(password, BCRYPT_PREFIX + bcryptSalt);
	// Remove bcrypt prefix and salt (first 29 characters)
	return hash.slice(29);
}
