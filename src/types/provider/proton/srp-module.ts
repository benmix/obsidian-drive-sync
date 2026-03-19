import type { SrpResult } from "@contracts/provider/proton/auth-types";

export interface SRPVerifier {
	modulusId: string;
	version: number;
	salt: string;
	verifier: string;
}

export interface SRPModuleInterface {
	getSrp(
		version: number,
		modulus: string,
		serverEphemeral: string,
		salt: string,
		password: string,
	): Promise<SrpResult>;
	getSrpVerifier(password: string): Promise<SRPVerifier>;
	computeKeyPassword(password: string, salt: string): Promise<string>;
}
