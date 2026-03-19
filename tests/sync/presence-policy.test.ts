import type { SyncEntry } from "@contracts/data/sync-schema";
import {
	evaluateRemoteMissingConfirmation,
	REMOTE_MISSING_CONFIRM_ROUNDS,
	resolveBothPresentDecision,
	resolveLocalOnlyDecision,
	resolveRemoteOnlyDecision,
	resolveTrackedMissingDecision,
} from "@sync/planner/presence-policy";
import { createEntry, FIXED_NOW } from "@tests/helpers/sync-fixtures";
import { expect, test } from "vitest";

function trackedFile(overrides: Partial<SyncEntry> = {}): SyncEntry {
	return createEntry(overrides);
}

test("remote missing confirmation requires two rounds", () => {
	expect(REMOTE_MISSING_CONFIRM_ROUNDS).toBe(2);

	const first = evaluateRemoteMissingConfirmation(trackedFile(), FIXED_NOW);
	expect(first.confirmed).toBe(false);
	expect(first.nextCount).toBe(1);
	expect(first.sinceMs).toBe(FIXED_NOW);

	const second = evaluateRemoteMissingConfirmation(
		trackedFile({
			remoteMissingCount: 1,
			remoteMissingSinceMs: FIXED_NOW - 1000,
		}),
		FIXED_NOW,
	);
	expect(second.confirmed).toBe(true);
	expect(second.nextCount).toBe(2);
	expect(second.sinceMs).toBe(FIXED_NOW - 1000);
});

test("local-only tracked file uses remote_win delete-local", () => {
	const decision = resolveLocalOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		syncStrategy: "remote_win",
		prior: trackedFile(),
	});
	expect(decision.job?.op).toBe("delete-local");
	expect(decision.removePriorPath).toBe(false);
});

test("local-only tracked file uses local_win upload + remove stale mapping", () => {
	const decision = resolveLocalOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		syncStrategy: "local_win",
		prior: trackedFile(),
	});
	expect(decision.job?.op).toBe("upload");
	expect(decision.job?.reason).toBe("remote-missing");
	expect(decision.removePriorPath).toBe(true);
});

test("remote-only uses local_win delete-remote", () => {
	const decision = resolveRemoteOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		syncStrategy: "local_win",
		remoteId: "remote-a",
		remoteRev: "rev-a",
	});
	expect(decision.job?.op).toBe("delete-remote");
	expect(decision.job?.reason).toBe("local-missing");
});

test("remote-only uses bidirectional download", () => {
	const decision = resolveRemoteOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		syncStrategy: "bidirectional",
		remoteId: "remote-a",
		remoteRev: "rev-a",
	});
	expect(decision.job?.op).toBe("download");
	expect(decision.job?.reason).toBe("remote-only");
});

test("remote-only uses remote seed when preferRemoteSeed is true", () => {
	const decision = resolveRemoteOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		syncStrategy: "local_win",
		remoteId: "remote-a",
		remoteRev: "rev-a",
		preferRemoteSeed: true,
	});
	expect(decision.job?.op).toBe("download");
	expect(decision.job?.reason).toBe("initial-remote-seed");
});

test("remote-only with local tombstone deletes remote in non-remote_win modes", () => {
	const decision = resolveRemoteOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		syncStrategy: "local_win",
		prior: trackedFile({ tombstone: true }),
		remoteId: "remote-a",
		remoteRev: "rev-b",
	});
	expect(decision.job?.op).toBe("delete-remote");
	expect(decision.job?.reason).toBe("local-delete-pending");
});

test("both-present both-changed bidirectional marks conflict_pending and keeps canonical idle", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		syncStrategy: "bidirectional",
		remoteId: "remote-a",
		remoteRev: "rev-b",
		localMtimeMs: FIXED_NOW - 5000,
		localChanged: true,
		remoteChanged: true,
	});
	expect(decision.conflictPending).toBe(true);
	expect(decision.conflict).toMatchObject({
		remoteId: "remote-a",
		remoteRev: "rev-b",
		detectedAt: FIXED_NOW,
	});
	expect(decision.jobs.length).toBe(1);
	expect(decision.jobs[0]?.op).toBe("download");
	expect(decision.jobs[0]?.path).toContain("(conflicted remote");
});

test("both-present both-changed remote_win backs up local copy then downloads remote", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		syncStrategy: "remote_win",
		remoteId: "remote-a",
		remoteRev: "rev-b",
		localChanged: true,
		remoteChanged: true,
	});
	expect(decision.jobs.length).toBe(2);
	expect(decision.jobs[0]?.op).toBe("copy-local");
	expect(decision.jobs[0]?.reason).toBe("conflict-backup-local");
	expect(decision.jobs[1]?.op).toBe("download");
	expect(decision.jobs[1]?.reason).toBe("conflict-remote-win");
});

test("both-present local-only change under remote_win downloads remote", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		syncStrategy: "remote_win",
		remoteId: "remote-a",
		remoteRev: "rev-a",
		localChanged: true,
		remoteChanged: false,
	});
	expect(decision.jobs.length).toBe(1);
	expect(decision.jobs[0]?.op).toBe("download");
	expect(decision.jobs[0]?.reason).toBe("remote-authority");
});

test("both-present remote-only change under local_win uploads local", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		syncStrategy: "local_win",
		remoteId: "remote-a",
		remoteRev: "rev-b",
		localChanged: false,
		remoteChanged: true,
	});
	expect(decision.jobs.length).toBe(1);
	expect(decision.jobs[0]?.op).toBe("upload");
	expect(decision.jobs[0]?.reason).toBe("local-authority");
});

test("both-present conflict_pending suppresses canonical jobs", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		syncStrategy: "bidirectional",
		remoteId: "remote-a",
		remoteRev: "rev-b",
		localChanged: true,
		remoteChanged: false,
		prior: trackedFile({
			conflictPending: true,
			conflict: { detectedAt: FIXED_NOW - 10_000, remoteId: "remote-a" },
		}),
	});
	expect(decision.jobs).toEqual([]);
	expect(decision.conflictPending).toBe(true);
});

test("tracked-missing chooses delete-remote when entry had remoteId", () => {
	const decision = resolveTrackedMissingDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		prior: trackedFile(),
	});
	expect(decision.job?.op).toBe("delete-remote");
	expect(decision.job?.reason).toBe("local-missing");
});

test("tracked-missing chooses delete-local when entry had no remoteId", () => {
	const decision = resolveTrackedMissingDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		prior: trackedFile({ remoteId: undefined }),
	});
	expect(decision.job?.op).toBe("delete-local");
	expect(decision.job?.reason).toBe("remote-missing");
});
