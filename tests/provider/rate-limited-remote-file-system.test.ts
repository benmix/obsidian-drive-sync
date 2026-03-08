import { describe, expect, test } from "vitest";
import { RateLimitedRemoteFileSystem } from "../../src/provider/strategy/rate-limited-remote-file-system-strategy";
import type { RemoteFileSystem } from "../../src/filesystem";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

describe("RateLimitedRemoteFileSystem", () => {
	test("limits concurrent operations", async () => {
		let active = 0;
		let peak = 0;

		const inner: RemoteFileSystem = {
			listEntries: async () => [],
			listFiles: async () => [],
			uploadFile: async () => {
				active += 1;
				peak = Math.max(peak, active);
				await delay(20);
				active -= 1;
				return {};
			},
			downloadFile: async () => new Uint8Array(),
		};

		const remoteFileSystem = new RateLimitedRemoteFileSystem(inner, {
			maxConcurrent: 1,
			minIntervalMs: 0,
		});

		await Promise.all([
			remoteFileSystem.uploadFile("a.md", new Uint8Array()),
			remoteFileSystem.uploadFile("b.md", new Uint8Array()),
			remoteFileSystem.uploadFile("c.md", new Uint8Array()),
		]);

		expect(peak).toBe(1);
	});

	test("enforces minimum start interval between queued operations", async () => {
		const startTimes: number[] = [];

		const inner: RemoteFileSystem = {
			listEntries: async () => {
				startTimes.push(Date.now());
				return [];
			},
			listFiles: async () => [],
			uploadFile: async () => ({}),
			downloadFile: async () => new Uint8Array(),
		};

		const remoteFileSystem = new RateLimitedRemoteFileSystem(inner, {
			maxConcurrent: 1,
			minIntervalMs: 30,
		});

		await Promise.all([
			remoteFileSystem.listEntries(),
			remoteFileSystem.listEntries(),
			remoteFileSystem.listEntries(),
		]);

		expect(startTimes).toHaveLength(3);
		expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(20);
		expect(startTimes[2] - startTimes[1]).toBeGreaterThanOrEqual(20);
	});

	test("falls back to listEntries for listFolders when inner does not implement it", async () => {
		const inner: RemoteFileSystem = {
			listEntries: async () => [
				{ id: "f1", name: "folder", path: "folder", type: "folder" },
				{ id: "a1", name: "a.md", path: "a.md", type: "file" },
			],
			listFiles: async () => [{ id: "a1", name: "a.md", path: "a.md", type: "file" }],
			uploadFile: async () => ({}),
			downloadFile: async () => new Uint8Array(),
		};

		const remoteFileSystem = new RateLimitedRemoteFileSystem(inner, {
			maxConcurrent: 1,
			minIntervalMs: 0,
		});

		await expect(remoteFileSystem.listFolders()).resolves.toEqual([
			{ id: "f1", name: "folder", path: "folder", type: "folder" },
		]);
	});

	test("rejects optional methods when inner adapter does not implement them", async () => {
		const inner: RemoteFileSystem = {
			listEntries: async () => [],
			listFiles: async () => [],
			uploadFile: async () => ({}),
			downloadFile: async () => new Uint8Array(),
		};

		const remoteFileSystem = new RateLimitedRemoteFileSystem(inner, {
			maxConcurrent: 1,
			minIntervalMs: 0,
		});

		await expect(remoteFileSystem.deletePath("node-a")).rejects.toThrow(
			"RemoteFileSystem.deletePath is not implemented.",
		);
	});

	test("applies adaptive cooldown after rate-limit errors", async () => {
		const startTimes: number[] = [];
		let attempt = 0;

		const inner: RemoteFileSystem = {
			listEntries: async () => {
				startTimes.push(Date.now());
				attempt += 1;
				if (attempt === 1) {
					throw new Error("429 too many requests");
				}
				return [];
			},
			listFiles: async () => [],
			uploadFile: async () => ({}),
			downloadFile: async () => new Uint8Array(),
		};

		const remoteFileSystem = new RateLimitedRemoteFileSystem(inner, {
			cooldownBaseMs: 40,
			cooldownMaxMs: 40,
			maxConcurrent: 1,
			minIntervalMs: 0,
		});

		const first = remoteFileSystem.listEntries();
		const second = remoteFileSystem.listEntries();

		await expect(first).rejects.toThrow("429 too many requests");
		await expect(second).resolves.toEqual([]);

		expect(startTimes).toHaveLength(2);
		expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(30);
	});

	test("respects retryAfterMs from error payload", async () => {
		const startTimes: number[] = [];
		let attempt = 0;

		const inner: RemoteFileSystem = {
			listEntries: async () => {
				startTimes.push(Date.now());
				attempt += 1;
				if (attempt === 1) {
					const error = new Error("rate limit");
					(
						error as Error & {
							status?: number;
							retryAfterMs?: number;
						}
					).status = 429;
					(
						error as Error & {
							status?: number;
							retryAfterMs?: number;
						}
					).retryAfterMs = 60;
					throw error;
				}
				return [];
			},
			listFiles: async () => [],
			uploadFile: async () => ({}),
			downloadFile: async () => new Uint8Array(),
		};

		const remoteFileSystem = new RateLimitedRemoteFileSystem(inner, {
			cooldownBaseMs: 10,
			cooldownMaxMs: 100,
			maxConcurrent: 1,
			minIntervalMs: 0,
		});

		const first = remoteFileSystem.listEntries();
		const second = remoteFileSystem.listEntries();

		await expect(first).rejects.toThrow("rate limit");
		await expect(second).resolves.toEqual([]);

		expect(startTimes).toHaveLength(2);
		expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(50);
	});
});
