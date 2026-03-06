import { createJob, FIXED_NOW } from "../helpers/sync-fixtures";
import { describe, expect, test } from "vitest";
import { SyncJobQueue } from "../../src/sync/engine/job-queue";

describe("SyncJobQueue", () => {
	test("enqueue defaults status and ignores duplicate id", () => {
		const queue = new SyncJobQueue();
		queue.enqueue(createJob({ id: "job-a" }));
		queue.enqueue(createJob({ id: "job-a", priority: 10 }));

		const jobs = queue.list();
		expect(jobs.length).toBe(1);
		expect(jobs[0]?.status).toBe("pending");
		expect(jobs[0]?.priority).toBe(5);
	});

	test("enqueueMany deduplicates existing and same-batch ids", () => {
		const queue = new SyncJobQueue([createJob({ id: "job-a" })]);
		queue.enqueueMany([
			createJob({ id: "job-a", priority: 99 }),
			createJob({ id: "job-b" }),
			createJob({ id: "job-b", priority: 99 }),
		]);

		expect(queue.list().map((job) => job.id)).toEqual(["job-a", "job-b"]);
	});

	test("sorts by priority desc, nextRunAt asc, then id", () => {
		const queue = new SyncJobQueue();
		queue.enqueue(createJob({ id: "c", priority: 10, nextRunAt: FIXED_NOW + 2000 }));
		queue.enqueue(createJob({ id: "b", priority: 10, nextRunAt: FIXED_NOW + 1000 }));
		queue.enqueue(createJob({ id: "a", priority: 10, nextRunAt: FIXED_NOW + 1000 }));
		queue.enqueue(createJob({ id: "z", priority: 5, nextRunAt: FIXED_NOW }));

		expect(queue.list().map((job) => job.id)).toEqual(["a", "b", "c", "z"]);
	});

	test("peek and next return queue head in order", () => {
		const queue = new SyncJobQueue([
			createJob({ id: "job-a", priority: 10 }),
			createJob({ id: "job-b", priority: 5 }),
		]);

		expect(queue.peek()?.id).toBe("job-a");
		expect(queue.next()?.id).toBe("job-a");
		expect(queue.next()?.id).toBe("job-b");
		expect(queue.next()).toBeUndefined();
	});
});
