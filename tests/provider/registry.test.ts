import { describe, expect, test } from "vitest";

import { LocalProviderRegistry, RemoteProviderRegistry } from "../../src/provider/registry";

describe("provider registry errors", () => {
	test("empty remote registry get throws CONFIG_PROVIDER_MISSING", () => {
		const registry = new RemoteProviderRegistry();
		expect(() => registry.get("proton-drive")).toThrowError(
			expect.objectContaining({
				code: "CONFIG_PROVIDER_MISSING",
				category: "config",
			}),
		);
	});

	test("empty local registry get throws CONFIG_PROVIDER_MISSING", () => {
		const registry = new LocalProviderRegistry();
		expect(() => registry.get("obsidian-local")).toThrowError(
			expect.objectContaining({
				code: "CONFIG_PROVIDER_MISSING",
				category: "config",
			}),
		);
	});
});
