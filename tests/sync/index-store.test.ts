import { createEntry, createState, FIXED_NOW } from "../helpers/sync-fixtures";
import { describe, expect, test } from "vitest";
import { SyncIndexStore } from "../../src/sync/index-store";

describe("SyncIndexStore", () => {
	test("clears tombstone when a live entry is written", () => {
		const store = new SyncIndexStore(
			createState([
				createEntry({
					relPath: "notes/a.md",
					type: "file",
					tombstone: true,
				}),
			]),
		);

		store.setEntry({
			relPath: "notes/a.md",
			type: "file",
			localMtimeMs: 100,
		});

		expect(store.getEntry("notes/a.md")?.tombstone).toBeUndefined();
	});

	test("clears remote-missing tracking when remote id is refreshed", () => {
		const store = new SyncIndexStore(
			createState([
				createEntry({
					relPath: "notes/a.md",
					remoteMissingCount: 2,
					remoteMissingSinceMs: FIXED_NOW - 10_000,
				}),
			]),
		);

		store.setEntry({
			relPath: "notes/a.md",
			type: "file",
			remoteId: "remote-a",
		});

		const entry = store.getEntry("notes/a.md");
		expect(entry?.remoteMissingCount).toBeUndefined();
		expect(entry?.remoteMissingSinceMs).toBeUndefined();
	});

	test("keeps remote-missing tracking when caller updates counters explicitly", () => {
		const store = new SyncIndexStore(
			createState([
				createEntry({
					relPath: "notes/a.md",
					remoteMissingCount: 1,
					remoteMissingSinceMs: FIXED_NOW - 1_000,
				}),
			]),
		);

		store.setEntry({
			relPath: "notes/a.md",
			type: "file",
			remoteId: "remote-a",
			remoteMissingCount: 3,
			remoteMissingSinceMs: FIXED_NOW,
		});

		const entry = store.getEntry("notes/a.md");
		expect(entry?.remoteMissingCount).toBe(3);
		expect(entry?.remoteMissingSinceMs).toBe(FIXED_NOW);
	});

	test("accumulates runtime metrics and tracks peaks", () => {
		const store = new SyncIndexStore(createState());
		store.updateRuntimeMetrics({
			lastRunAt: FIXED_NOW,
			lastRunDurationMs: 2000,
			lastRunJobsExecuted: 3,
			lastRunEntriesUpdated: 4,
			lastRunFailures: 1,
			lastRunUploadBytes: 1500,
			lastRunDownloadBytes: 500,
			peakQueueDepth: 4,
			peakPendingJobs: 3,
			peakBlockedJobs: 1,
		});
		store.updateRuntimeMetrics({
			lastRunAt: FIXED_NOW + 10_000,
			lastRunDurationMs: 1000,
			lastRunJobsExecuted: 2,
			lastRunEntriesUpdated: 2,
			lastRunFailures: 0,
			lastRunUploadBytes: 500,
			lastRunDownloadBytes: 1000,
			peakQueueDepth: 2,
			peakPendingJobs: 5,
			peakBlockedJobs: 2,
		});

		const metrics = store.toJSON().runtimeMetrics;
		expect(metrics).toMatchObject({
			totalRuns: 2,
			totalFailures: 1,
			totalUploadBytes: 2000,
			totalDownloadBytes: 1500,
			peakQueueDepth: 4,
			peakPendingJobs: 5,
			peakBlockedJobs: 2,
			lastRunThroughputBytesPerSec: 1500,
		});
	});

	test("keeps only latest 200 logs", () => {
		const store = new SyncIndexStore(createState());
		for (let index = 0; index < 205; index += 1) {
			store.addLog(`log-${index}`);
		}

		const logs = store.toJSON().logs ?? [];
		expect(logs.length).toBe(200);
		expect(logs[0]?.message).toBe("log-5");
		expect(logs[199]?.message).toBe("log-204");
	});
});
