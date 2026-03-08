import { createOpenPGPCrypto, initCrypto } from "./proton-auth/openpgp";
import {
	createProtonAccount,
	createProtonHttpClient,
	createSrpModule,
} from "./proton-auth/sdk-helpers";
import type {
	ProtonSession,
	SdkSessionBundle,
} from "../../../../contracts/provider/proton/sdk-session";
import { createOpenPGPCryptoProxy } from "./openpgp-proxy";
import { createSdkTelemetry } from "./telemetry";
import { OpenPGPCryptoWithCryptoProxy } from "@protontech/drive-sdk";

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
