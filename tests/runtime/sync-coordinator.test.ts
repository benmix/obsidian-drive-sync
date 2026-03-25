import { beforeEach, describe, expect, test, vi } from "vitest";

const harness = vi.hoisted(() => ({
	syncRunnerCtor: vi.fn(),
	syncRunnerRun: vi.fn(),
}));

vi.mock("@sync/use-cases/sync-runner", () => ({
	SyncRunner: class {
		constructor(...args: unknown[]) {
			harness.syncRunnerCtor(...args);
		}

		run = harness.syncRunnerRun;
	},
}));

import { SyncCoordinator } from "@runtime/sync-coordinator";

describe("SyncCoordinator", () => {
	beforeEach(() => {
		harness.syncRunnerCtor.mockReset();
		harness.syncRunnerRun.mockReset();
		harness.syncRunnerRun.mockImplementation(async () => {});
	});

	test("returns early when no remote scope is configured", async () => {
		const plugin = {
			getRemoteConnectionView: () => ({ scopeId: "" }),
			settings: { syncStrategy: "bidirectional" },
		};
		const sessionManager = {
			connectClient: vi.fn(),
			pauseAuth: vi.fn(),
		};
		const coordinator = new SyncCoordinator(plugin as never, sessionManager as never);

		await coordinator.run({
			trigger: "manual",
			force: false,
			localChanges: [],
		});

		expect(sessionManager.connectClient).not.toHaveBeenCalled();
		expect(harness.syncRunnerRun).not.toHaveBeenCalled();
	});

	test("builds file systems and forwards auth failures to the session manager", async () => {
		const localFileSystem = { id: "local-fs" };
		const remoteFileSystem = { id: "remote-fs" };
		const client = { id: "client-1" };
		const localProvider = {
			createLocalFileSystem: vi.fn(() => localFileSystem),
		};
		const remoteProvider = {
			createRemoteFileSystem: vi.fn(() => remoteFileSystem),
		};
		const plugin = {
			app: { id: "app-1" },
			settings: { syncStrategy: "bidirectional" },
			getRemoteConnectionView: () => ({ scopeId: "scope-1" }),
			getLocalProvider: () => localProvider,
			getRemoteProvider: () => remoteProvider,
		};
		const sessionManager = {
			connectClient: vi.fn(async () => client),
			pauseAuth: vi.fn(),
		};
		const request = {
			trigger: "interval" as const,
			force: false,
			localChanges: [],
		};
		const coordinator = new SyncCoordinator(plugin as never, sessionManager as never);

		await coordinator.run(request);

		expect(sessionManager.connectClient).toHaveBeenCalledTimes(1);
		expect(localProvider.createLocalFileSystem).toHaveBeenCalledWith(plugin.app);
		expect(remoteProvider.createRemoteFileSystem).toHaveBeenCalledWith(client, "scope-1");
		expect(harness.syncRunnerRun).toHaveBeenCalledTimes(1);
		const [receivedRequest, context] = harness.syncRunnerRun.mock.calls[0] ?? [];
		expect(receivedRequest).toBe(request);
		expect(context).toMatchObject({
			localFileSystem,
			remoteFileSystem,
			syncStrategy: "bidirectional",
		});

		const authError = new Error("auth");
		context.onAuthError(authError);
		expect(sessionManager.pauseAuth).toHaveBeenCalledWith(authError);
	});
});
