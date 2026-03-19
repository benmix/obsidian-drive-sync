import * as openpgp from "openpgp";

import type {
	AuthInfo,
	Credentials,
	SrpProofs,
	SrpResult,
} from "../../../../../../contracts/provider/proton/auth-types";
import { SRP_LEN, SRP_MODULUS_KEY } from "../../../../../../contracts/provider/proton/auth-types";

import {
	base64Decode,
	base64Encode,
	bigIntByteLength,
	bigIntToUint8ArrayLE,
	expandHash,
	hashPassword,
	mergeUint8Arrays,
	mod,
	modExp,
	uint8ArrayToBigIntLE,
	uint8ArrayToBinaryString,
} from "./crypto-utils";

// ============================================================================
// SRP Protocol
// ============================================================================

interface GenerateProofsParams {
	byteLength: number;
	modulusArray: Uint8Array;
	hashedPasswordArray: Uint8Array;
	serverEphemeralArray: Uint8Array;
}

/**
 * Verify and extract modulus from signed message
 */
export async function verifyAndGetModulus(signedModulus: string): Promise<Uint8Array> {
	// Import the verification key
	const publicKey = await openpgp.readKey({ armoredKey: SRP_MODULUS_KEY });

	// Read and verify the cleartext message
	const message = await openpgp.readCleartextMessage({
		cleartextMessage: signedModulus,
	});
	const verificationResult = await openpgp.verify({
		message,
		verificationKeys: publicKey,
	});

	// Check verification status
	const signature = verificationResult.signatures[0];

	if (!signature) {
		throw new Error("Unable to verify server identity");
	}

	const { verified } = signature;

	try {
		await verified;
	} catch {
		throw new Error("Unable to verify server identity");
	}

	// Extract and decode the modulus
	const modulusData = verificationResult.data;
	return base64Decode(modulusData);
}

/**
 * Generate SRP proofs
 */
async function generateProofs({
	byteLength,
	modulusArray,
	hashedPasswordArray,
	serverEphemeralArray,
}: GenerateProofsParams): Promise<SrpProofs> {
	const modulus = uint8ArrayToBigIntLE(modulusArray.slice().reverse());

	if (bigIntByteLength(modulus) !== byteLength) {
		throw new Error("SRP modulus has incorrect size");
	}

	const generator = 2n;
	const generatorArray = bigIntToUint8ArrayLE(generator, byteLength);
	const multiplierHash = await expandHash(mergeUint8Arrays([generatorArray, modulusArray]));
	const multiplier = uint8ArrayToBigIntLE(multiplierHash.slice().reverse());

	const serverEphemeral = uint8ArrayToBigIntLE(serverEphemeralArray.slice().reverse());
	const hashedPassword = uint8ArrayToBigIntLE(hashedPasswordArray.slice().reverse());

	if (serverEphemeral === 0n) {
		throw new Error("SRP server ephemeral is out of bounds");
	}

	const modulusMinusOne = modulus - 1n;
	const multiplierReduced = mod(multiplier, modulus);

	// Generate client secret and ephemeral
	let clientSecret: bigint = 0n;
	let clientEphemeral: bigint = 0n;
	let scramblingParam: bigint = 0n;

	for (let i = 0; i < 1000; i++) {
		const randomBytes = crypto.getRandomValues(new Uint8Array(byteLength));
		clientSecret = uint8ArrayToBigIntLE(randomBytes.slice().reverse());
		clientEphemeral = modExp(generator, clientSecret, modulus);

		const clientEphemeralArray = bigIntToUint8ArrayLE(clientEphemeral, byteLength);
		const clientServerHash = await expandHash(
			mergeUint8Arrays([clientEphemeralArray, serverEphemeralArray]),
		);
		scramblingParam = uint8ArrayToBigIntLE(clientServerHash.slice().reverse());

		if (scramblingParam !== 0n && clientEphemeral !== 0n) {
			break;
		}
	}

	// Calculate shared session key
	const kgx = mod(modExp(generator, hashedPassword, modulus) * multiplierReduced, modulus);
	const sharedSessionKeyExponent = mod(
		scramblingParam * hashedPassword + clientSecret,
		modulusMinusOne,
	);
	const sharedSessionKeyBase = mod(serverEphemeral - kgx, modulus);
	const sharedSessionKey = modExp(sharedSessionKeyBase, sharedSessionKeyExponent, modulus);

	const clientEphemeralArray = bigIntToUint8ArrayLE(clientEphemeral, byteLength);
	const sharedSessionArray = bigIntToUint8ArrayLE(sharedSessionKey, byteLength);

	// Generate proofs
	const clientProof = await expandHash(
		mergeUint8Arrays([clientEphemeralArray, serverEphemeralArray, sharedSessionArray]),
	);
	const expectedServerProof = await expandHash(
		mergeUint8Arrays([clientEphemeralArray, clientProof, sharedSessionArray]),
	);

	return {
		clientEphemeral: clientEphemeralArray,
		clientProof,
		expectedServerProof,
		sharedSession: sharedSessionArray,
	};
}

/**
 * Get SRP authentication parameters
 */
export async function getSrp(authInfo: AuthInfo, credentials: Credentials): Promise<SrpResult> {
	const { Version, Modulus: serverModulus, ServerEphemeral, Salt } = authInfo;
	const { password } = credentials;

	const modulusArray = await verifyAndGetModulus(serverModulus);
	const serverEphemeralArray = base64Decode(ServerEphemeral);

	const hashedPasswordArray = await hashPassword({
		version: Version,
		password,
		salt: Version >= 3 ? uint8ArrayToBinaryString(base64Decode(Salt)) : undefined,
		modulus: modulusArray,
	});

	const { clientEphemeral, clientProof, expectedServerProof } = await generateProofs({
		byteLength: SRP_LEN,
		modulusArray,
		hashedPasswordArray,
		serverEphemeralArray,
	});

	return {
		clientEphemeral: base64Encode(clientEphemeral),
		clientProof: base64Encode(clientProof),
		expectedServerProof: base64Encode(expectedServerProof),
	};
}
