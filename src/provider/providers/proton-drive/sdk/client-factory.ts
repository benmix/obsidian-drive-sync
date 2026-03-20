import type { ProtonSession, SdkSessionBundle } from "@contracts/provider/proton/sdk-session";
import { OpenPGPCryptoWithCryptoProxy } from "@protontech/drive-sdk";
import { createOpenPGPCrypto, initCrypto } from "@provider/providers/proton-drive/crypto/openpgp";
import { createProtonAccount } from "@provider/providers/proton-drive/sdk/account";
import { createProtonHttpClient } from "@provider/providers/proton-drive/sdk/http-client";
import { createOpenPGPCryptoProxy } from "@provider/providers/proton-drive/sdk/openpgp-proxy";
import { createSrpModule } from "@provider/providers/proton-drive/sdk/srp-module";
import { createSdkTelemetry } from "@provider/providers/proton-drive/sdk/telemetry";

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
