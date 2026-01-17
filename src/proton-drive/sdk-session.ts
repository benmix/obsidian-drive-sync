import type {
	ProtonDriveHTTPClient,
	ProtonDriveAccount,
	Telemetry,
	MetricEvent,
} from "@protontech/drive-sdk";
import { OpenPGPCryptoWithCryptoProxy } from "@protontech/drive-sdk";
import type { OpenPGPCryptoProxy, SRPModule } from "@protontech/drive-sdk";
import {
	createProtonHttpClient,
	createProtonAccount,
	createOpenPGPCrypto,
	createSrpModule,
	initCrypto,
	type Session,
} from "./proton-auth";

export type ProtonSession = Session & {
	onTokenRefresh?: () => Promise<void>;
};

export type SdkSessionBundle = {
	httpClient: ProtonDriveHTTPClient;
	account: ProtonDriveAccount;
	openPGPCryptoModule: OpenPGPCryptoWithCryptoProxy;
	srpModule: SRPModule;
	telemetry?: Telemetry<MetricEvent>;
};

export async function buildSdkSessionClient(
	session: ProtonSession,
	onTokenRefresh?: () => Promise<void>,
): Promise<SdkSessionBundle> {
	await initCrypto();
	const httpClient = createProtonHttpClient(session, onTokenRefresh);
	const openPGPCrypto = createOpenPGPCrypto();
	const cryptoProxy = openPGPCrypto as unknown as OpenPGPCryptoProxy;
	const openPGPCryptoModule = new OpenPGPCryptoWithCryptoProxy(cryptoProxy);
	const account = createProtonAccount(session, openPGPCrypto);
	const srpModule = createSrpModule();

	return {
		httpClient,
		account,
		openPGPCryptoModule,
		srpModule,
	};
}
