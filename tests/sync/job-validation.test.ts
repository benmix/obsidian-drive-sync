import { assertExecutableJob, isExecutableJob } from "@sync/engine/job-validation";
import { createJob } from "@tests/helpers/sync-fixtures";
import { describe, expect, test } from "vitest";

describe("job-validation", () => {
	test("recognizes executable jobs with required fields", () => {
		const job = createJob({
			op: "move-remote",
			remoteId: "remote-1",
			toPath: "notes/b.md",
		});

		expect(isExecutableJob(job)).toBe(true);
		expect(assertExecutableJob(job)).toMatchObject({
			op: "move-remote",
			remoteId: "remote-1",
			toPath: "notes/b.md",
		});
	});

	test("throws a structured invalid-job error when required fields are missing", () => {
		const job = createJob({
			op: "download",
			remoteId: undefined,
		});

		let error: unknown;
		try {
			assertExecutableJob(job);
		} catch (caught) {
			error = caught;
		}

		expect(error).toMatchObject({
			code: "SYNC_JOB_INVALID",
			details: {
				jobId: "job-1",
				missing: "remoteId",
			},
		});
	});
});
