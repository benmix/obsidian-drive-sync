import type { ProtonDriveAccount, ProtonDriveAccountAddress } from "@protontech/drive-sdk";

export type OwnAddress = ProtonDriveAccountAddress;
export type DriveAccountPrivateKey = OwnAddress["keys"][number]["key"];
export type DriveAccountPublicKey = Awaited<
	ReturnType<ProtonDriveAccount["getPublicKeys"]>
>[number];
