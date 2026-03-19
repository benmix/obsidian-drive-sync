import { OpenPGPCryptoWithCryptoProxy } from "@protontech/drive-sdk";

import type {
	ProtonSession,
	SdkSessionBundle,
} from "../../../../contracts/provider/proton/sdk-session";

import { createOpenPGPCryptoProxy } from "./openpgp-proxy";
import { createOpenPGPCrypto, initCrypto } from "./proton-auth/crypto/openpgp";
import {
	createProtonAccount,
	createProtonHttpClient,
	createSrpModule,
} from "./proton-auth/sdk/adapters";
import { createSdkTelemetry } from "./telemetry";

export async function buildSdkSessionClient(
	session: ProtonSession,
	onTokenRefresh?: () => Promise<void>,
	getSession?: () => ProtonSession | null,
): Promise<SdkSessionBundle> {
	await initCrypto();
	const httpClient = createProtonHttpClient(getSession ?? session, onTokenRefresh);
	const openPGPCryptoModule = new OpenPGPCryptoWithCryptoProxy(createOpenPGPCryptoProxy());
	const account = createProtonAccount(getSession ?? session, createOpenPGPCrypto());
	const srpModule = createSrpModule();
	const telemetry = createSdkTelemetry();

	return {
		httpClient,
		account,
		openPGPCryptoModule,
		srpModule,
		telemetry,
	};
}
