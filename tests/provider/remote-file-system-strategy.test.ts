import { describe, expect, test } from "vitest";

import {
	applyRemoteFileSystemStrategies,
	type RemoteFileSystemStrategy,
} from "../../src/provider/strategy/contracts";
import {
	createRateLimitedRemoteFileSystemStrategy,
	RateLimitedRemoteFileSystem,
} from "../../src/provider/strategy/rate-limited-remote-file-system-strategy";

import type { RemoteFileSystem } from "../../src/filesystem";

describe("remote file system strategies", () => {
	test("applies strategies as a composable chain", async () => {
		const calls: string[] = [];
		const baseRemoteFileSystem: RemoteFileSystem = {
			listEntries: async () => {
				calls.push("base");
				return [];
			},
			listFiles: async () => [],
			uploadFile: async () => ({}),
			downloadFile: async () => new Uint8Array(),
		};
		const strategyA: RemoteFileSystemStrategy = (remoteFileSystem, context) => {
			calls.push(`compose-a:${context.providerId}:${context.scopeId}`);
			return {
				...remoteFileSystem,
				listEntries: async () => {
					calls.push("run-a");
					return await remoteFileSystem.listEntries();
				},
			};
		};
		const strategyB: RemoteFileSystemStrategy = (remoteFileSystem, context) => {
			calls.push(`compose-b:${context.providerId}:${context.scopeId}`);
			return {
				...remoteFileSystem,
				listEntries: async () => {
					calls.push("run-b");
					return await remoteFileSystem.listEntries();
				},
			};
		};

		const remoteFileSystem = applyRemoteFileSystemStrategies(
			baseRemoteFileSystem,
			{
				providerId: "provider-a",
				client: {},
				scopeId: "scope-root",
			},
			[strategyA, strategyB],
		);

		await remoteFileSystem.listEntries();
		expect(calls).toEqual([
			"compose-a:provider-a:scope-root",
			"compose-b:provider-a:scope-root",
			"run-b",
			"run-a",
			"base",
		]);
	});

	test("reuses shared rate-limit strategy factory", async () => {
		const baseRemoteFileSystem: RemoteFileSystem = {
			listEntries: async () => [],
			listFiles: async () => [],
			uploadFile: async () => ({}),
			downloadFile: async () => new Uint8Array(),
		};
		const strategy = createRateLimitedRemoteFileSystemStrategy({
			maxConcurrent: 1,
			minIntervalMs: 0,
		});

		const remoteFileSystem = strategy(baseRemoteFileSystem, {
			providerId: "provider-a",
			client: {},
			scopeId: "scope-root",
		});

		expect(remoteFileSystem).toBeInstanceOf(RateLimitedRemoteFileSystem);
		await expect(remoteFileSystem.listEntries()).resolves.toEqual([]);
	});
});
