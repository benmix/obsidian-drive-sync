import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@commands": path.resolve(__dirname, "src/commands"),
			"@config": path.resolve(__dirname, "src/internal-config.ts"),
			"@contracts": path.resolve(__dirname, "src/types"),
			"@data": path.resolve(__dirname, "src/data"),
			"@errors": path.resolve(__dirname, "src/errors"),
			"@filesystem": path.resolve(__dirname, "src/filesystem"),
			"@i18n": path.resolve(__dirname, "src/i18n"),
			"@provider": path.resolve(__dirname, "src/provider"),
			"@runtime": path.resolve(__dirname, "src/runtime"),
			"@sync": path.resolve(__dirname, "src/sync"),
			"@ui": path.resolve(__dirname, "src/ui"),
			"@tests": path.resolve(__dirname, "tests"),
			obsidian: path.resolve(__dirname, "tests/mocks/obsidian.ts"),
		},
	},
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
		clearMocks: true,
		restoreMocks: true,
		mockReset: true,
	},
});
