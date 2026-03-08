import { OpenPGPCryptoWithCryptoProxy } from "@protontech/drive-sdk";

import type {
	ProtonSession,
	SdkSessionBundle,
} from "../../../../contracts/provider/proton/sdk-session";

import { createOpenPGPCryptoProxy } from "./openpgp-proxy";
import { createOpenPGPCrypto, initCrypto } from "./proton-auth/openpgp";
import {
	createProtonAccount,
	createProtonHttpClient,
	createSrpModule,
} from "./proton-auth/sdk-helpers";
import { createSdkTelemetry } from "./telemetry";

export async function buildSdkSessionClient(
	session: ProtonSession,
	onTokenRefresh?: () => Promise<void>,
): Promise<SdkSessionBundle> {
	await initCrypto();
	const httpClient = createProtonHttpClient(session, onTokenRefresh);
	const openPGPCryptoModule = new OpenPGPCryptoWithCryptoProxy(createOpenPGPCryptoProxy());
	const account = createProtonAccount(session, createOpenPGPCrypto());
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
