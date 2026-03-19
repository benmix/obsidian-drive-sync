import type { Session } from "@contracts/provider/proton/auth-types";
import type { SRPModuleInterface } from "@contracts/provider/proton/srp-module";
import type {
	MetricEvent,
	ProtonDriveAccount,
	ProtonDriveHTTPClient,
	Telemetry,
} from "@protontech/drive-sdk";
import type { OpenPGPCryptoWithCryptoProxy } from "@protontech/drive-sdk";

export type ProtonSession = Session;

export type SdkSessionBundle = {
	httpClient: ProtonDriveHTTPClient;
	account: ProtonDriveAccount;
	openPGPCryptoModule: OpenPGPCryptoWithCryptoProxy;
	srpModule: SRPModuleInterface;
	telemetry?: Telemetry<MetricEvent>;
};
