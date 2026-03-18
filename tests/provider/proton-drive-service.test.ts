import { beforeEach, describe, expect, test, vi } from "vitest";

const protonDriveClientCtor = vi.hoisted(() => vi.fn());

vi.mock("@protontech/drive-sdk", () => ({
	MemoryCache: class {},
	ProtonDriveClient: class {
		constructor(options: unknown) {
			protonDriveClientCtor(options);
		}
	},
}));

vi.mock("../../src/provider/providers/proton-drive/sdk/sdk-session", () => ({
	buildSdkSessionClient: async () => ({
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
	}),
}));

import { ProtonDriveService } from "../../src/provider/providers/proton-drive/sdk/service";

describe("ProtonDriveService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		protonDriveClientCtor.mockClear();
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
});
