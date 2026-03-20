import type { ApiResponse, AuthInfo, SrpResult } from "@contracts/provider/proton/auth-types";
import { AUTH_VERSION, SRP_LEN } from "@contracts/provider/proton/auth-types";
import type { SRPModuleInterface, SRPVerifier } from "@contracts/provider/proton/srp-module";
import {
	base64Encode,
	bigIntToUint8ArrayLE,
	computeKeyPassword,
	hashPassword,
	modExp,
	uint8ArrayToBigIntLE,
	uint8ArrayToBinaryString,
} from "@provider/providers/proton-drive/crypto/crypto-utils";
import { getSrp, verifyAndGetModulus } from "@provider/providers/proton-drive/crypto/srp";
import { apiRequest } from "@provider/providers/proton-drive/transport/api";

export function createSrpModule(): SRPModuleInterface {
	return {
		async getSrp(
			version: number,
			modulus: string,
			serverEphemeral: string,
			salt: string,
			password: string,
		): Promise<SrpResult> {
			const authInfo: AuthInfo = {
				Version: version,
				Modulus: modulus,
				ServerEphemeral: serverEphemeral,
				Salt: salt,
			};
			return await getSrp(authInfo, { password });
		},

		async getSrpVerifier(password: string): Promise<SRPVerifier> {
			const response = await apiRequest<ApiResponse & { Modulus: string; ModulusID: string }>(
				"GET",
				"core/v4/auth/modulus",
			);
			const modulus = await verifyAndGetModulus(response.Modulus);

			const saltBytes = crypto.getRandomValues(new Uint8Array(10));
			const salt = uint8ArrayToBinaryString(saltBytes);
			const hashedPassword = await hashPassword({
				version: AUTH_VERSION,
				password,
				salt,
				modulus,
			});

			const generator = 2n;
			const modulusBigInt = uint8ArrayToBigIntLE(modulus.slice().reverse());
			const hashedPasswordBigInt = uint8ArrayToBigIntLE(hashedPassword.slice().reverse());
			const verifier = modExp(generator, hashedPasswordBigInt, modulusBigInt);
			const verifierArray = bigIntToUint8ArrayLE(verifier, SRP_LEN);

			return {
				modulusId: response.ModulusID,
				version: AUTH_VERSION,
				salt: base64Encode(saltBytes),
				verifier: base64Encode(verifierArray),
			};
		},

		async computeKeyPassword(password: string, salt: string): Promise<string> {
			return await computeKeyPassword(password, salt);
		},
	};
}
