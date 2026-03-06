import { createEntry, FIXED_NOW } from "../helpers/sync-fixtures";
import {
	evaluateRemoteMissingConfirmation,
	REMOTE_MISSING_CONFIRM_ROUNDS,
	resolveBothPresentDecision,
	resolveLocalOnlyDecision,
	resolveRemoteOnlyDecision,
	resolveTrackedMissingDecision,
} from "../../src/sync/planner/presence-policy";
import { expect, test } from "vitest";
import type { SyncEntry } from "../../src/data/sync-schema";

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

test("local-only tracked file uses remote-wins delete-local", () => {
	const decision = resolveLocalOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		conflictStrategy: "remote-wins",
		prior: trackedFile(),
	});
	expect(decision.job?.op).toBe("delete-local");
	expect(decision.removePriorPath).toBe(false);
});

test("local-only tracked folder uses remote-wins folder delete reason", () => {
	const decision = resolveLocalOnlyDecision({
		path: "notes/folder",
		entryType: "folder",
		nowTs: FIXED_NOW,
		conflictStrategy: "remote-wins",
		prior: trackedFile({ relPath: "notes/folder", type: "folder" }),
	});
	expect(decision.job?.op).toBe("delete-local");
	expect(decision.job?.reason).toBe("remote-folder-delete");
	expect(decision.job?.priority).toBe(25);
});

test("local-only tracked file uses local-wins upload + remove stale mapping", () => {
	const decision = resolveLocalOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		conflictStrategy: "local-wins",
		prior: trackedFile(),
	});
	expect(decision.job?.op).toBe("upload");
	expect(decision.job?.reason).toBe("remote-missing");
	expect(decision.removePriorPath).toBe(true);
});

test("local-only new file is uploaded regardless of strategy", () => {
	const decision = resolveLocalOnlyDecision({
		path: "notes/new.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		conflictStrategy: "remote-wins",
		prior: undefined,
	});
	expect(decision.job?.op).toBe("upload");
	expect(decision.job?.reason).toBe("local-only");
	expect(decision.removePriorPath).toBe(false);
});

test("remote-only with local tombstone deletes remote in non-remote-wins modes", () => {
	const decision = resolveRemoteOnlyDecision({
		path: "notes/a.md",
		entryType: "file",
		nowTs: FIXED_NOW,
		conflictStrategy: "local-wins",
		prior: trackedFile({ tombstone: true }),
		remoteId: "remote-a",
		remoteRev: "rev-b",
	});
	expect(decision.job?.op).toBe("delete-remote");
	expect(decision.job?.reason).toBe("local-delete-pending");
});

test("remote-only folder without remote id produces no job", () => {
	const decision = resolveRemoteOnlyDecision({
		path: "notes/folder",
		entryType: "folder",
		nowTs: FIXED_NOW,
		conflictStrategy: "local-wins",
		prior: trackedFile({ type: "folder", remoteId: undefined }),
	});
	expect(decision.job).toBeUndefined();
});

test("both-present both-changed manual creates conflict hold", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		conflictStrategy: "manual",
		remoteId: "remote-a",
		remoteRev: "rev-b",
		localMtimeMs: FIXED_NOW - 5000,
		localChanged: true,
		remoteChanged: true,
	});
	expect(decision.conflict).toBeTruthy();
	expect(decision.jobs.length).toBe(1);
	expect(decision.jobs[0]?.reason).toBe("conflict-manual");
});

test("both-present local-only change uploads", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		conflictStrategy: "remote-wins",
		remoteId: "remote-a",
		remoteRev: "rev-a",
		localChanged: true,
		remoteChanged: false,
	});
	expect(decision.jobs.length).toBe(1);
	expect(decision.jobs[0]?.op).toBe("upload");
});

test("both-present remote-only change downloads", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		conflictStrategy: "local-wins",
		remoteId: "remote-a",
		remoteRev: "rev-b",
		localChanged: false,
		remoteChanged: true,
	});
	expect(decision.jobs.length).toBe(1);
	expect(decision.jobs[0]?.op).toBe("download");
});

test("both-present both-changed remote-wins downloads", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		conflictStrategy: "remote-wins",
		remoteId: "remote-a",
		remoteRev: "rev-b",
		localChanged: true,
		remoteChanged: true,
	});
	expect(decision.jobs.length).toBe(1);
	expect(decision.jobs[0]?.op).toBe("download");
	expect(decision.jobs[0]?.reason).toBe("conflict-remote-wins");
});

test("both-present both-changed remote-wins without remote id has no jobs", () => {
	const decision = resolveBothPresentDecision({
		path: "notes/a.md",
		nowTs: FIXED_NOW,
		conflictStrategy: "remote-wins",
		localChanged: true,
		remoteChanged: true,
	});
	expect(decision.jobs).toEqual([]);
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
