import type {
	MetricEvent,
	ProtonDriveAccount,
	ProtonDriveHTTPClient,
	Telemetry,
} from "@protontech/drive-sdk";
import type { OpenPGPCryptoWithCryptoProxy } from "@protontech/drive-sdk";

import type { Session } from "./auth-types";
import type { SRPModuleInterface } from "./srp-module";

export type ProtonSession = Session;

export type SdkSessionBundle = {
	httpClient: ProtonDriveHTTPClient;
	account: ProtonDriveAccount;
	openPGPCryptoModule: OpenPGPCryptoWithCryptoProxy;
	srpModule: SRPModuleInterface;
	telemetry?: Telemetry<MetricEvent>;
};
