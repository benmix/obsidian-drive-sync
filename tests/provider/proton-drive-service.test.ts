import { beforeEach, describe, expect, test, vi } from "vitest";

const protonDriveClientCtor = vi.hoisted(() => vi.fn());
const buildSdkSessionClientMock = vi.hoisted(() => vi.fn());

vi.mock("@protontech/drive-sdk", () => ({
	MemoryCache: class {},
	ProtonDriveClient: class {
		constructor(options: unknown) {
			protonDriveClientCtor(options);
		}
	},
}));

vi.mock("@provider/providers/proton-drive/sdk/client-factory", () => ({
	buildSdkSessionClient: buildSdkSessionClientMock,
}));

import { ProtonDriveService } from "@provider/providers/proton-drive/sdk/drive-service";

describe("ProtonDriveService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		protonDriveClientCtor.mockClear();
		buildSdkSessionClientMock.mockReset();
		buildSdkSessionClientMock.mockResolvedValue({
			httpClient: {
				fetchJson: async () => new Response(null, { status: 200 }),
				fetchBlob: async () => new Response(null, { status: 200 }),
			},
			account: {
				getOwnPrimaryAddress: async () => ({}),
				getOwnAddress: async () => ({}),
				getOwnAddresses: async () => [],
				hasProtonAccount: async () => true,
				getPublicKeys: async () => [],
			},
			openPGPCryptoModule: {},
			srpModule: {},
			telemetry: {
				getLogger: () => ({
					debug: () => {},
					info: () => {},
					warn: () => {},
					error: () => {},
				}),
				recordMetric: () => {},
			},
		});
	});

	test("recreates the SDK client when a new session object is provided", async () => {
		const service = new ProtonDriveService();
		const firstSession = {
			UID: "uid-1",
			AccessToken: "access-1",
			RefreshToken: "refresh-1",
		} as never;
		const secondSession = {
			UID: "uid-2",
			AccessToken: "access-2",
			RefreshToken: "refresh-2",
		} as never;

		const firstClient = await service.connect(firstSession);
		const secondClient = await service.connect(secondSession);

		expect(firstClient?.sdk).not.toBe(secondClient?.sdk);
		expect(protonDriveClientCtor).toHaveBeenCalledTimes(2);
	});

	test("reuses the existing client for the same session object", async () => {
		const service = new ProtonDriveService();
		const session = {
			UID: "uid-1",
			AccessToken: "access-1",
			RefreshToken: "refresh-1",
		} as never;

		const firstClient = await service.connect(session);
		const secondClient = await service.connect(session);

		expect(secondClient).toBe(firstClient);
		expect(protonDriveClientCtor).toHaveBeenCalledTimes(1);
		expect(buildSdkSessionClientMock).toHaveBeenCalledTimes(1);
	});

	test("returns null and clears cached state when client creation fails", async () => {
		const service = new ProtonDriveService();
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		buildSdkSessionClientMock.mockRejectedValueOnce(new Error("boom"));

		const client = await service.connect({
			UID: "uid-1",
			AccessToken: "access-1",
			RefreshToken: "refresh-1",
		} as never);

		expect(client).toBeNull();
		expect(service.getClient()).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			"Failed to connect to Proton Drive.",
			expect.any(Error),
		);
	});
});
