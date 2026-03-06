import { createOpenPGPCrypto, initCrypto } from "./proton-auth/openpgp";
import {
	createProtonAccount,
	createProtonHttpClient,
	createSrpModule,
	type SRPModuleInterface,
} from "./proton-auth/sdk-helpers";
import type {
	MetricEvent,
	ProtonDriveAccount,
	ProtonDriveHTTPClient,
	Telemetry,
} from "@protontech/drive-sdk";
import { createOpenPGPCryptoProxy } from "./openpgp-proxy";
import { createSdkTelemetry } from "./telemetry";
import { OpenPGPCryptoWithCryptoProxy } from "@protontech/drive-sdk";
import type { Session } from "./proton-auth/types";

export type ProtonSession = Session & {
	onTokenRefresh?: () => Promise<void>;
};

export type SdkSessionBundle = {
	httpClient: ProtonDriveHTTPClient;
	account: ProtonDriveAccount;
	openPGPCryptoModule: OpenPGPCryptoWithCryptoProxy;
	srpModule: SRPModuleInterface;
	telemetry?: Telemetry<MetricEvent>;
};

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
