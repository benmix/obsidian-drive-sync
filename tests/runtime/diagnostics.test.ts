import { describe, expect, test, vi } from "vitest";

import { exportDiagnostics } from "../../src/runtime/use-cases/diagnostics";

vi.mock("../../src/sync/state/state-store", () => ({
	PluginDataStateStore: class {
		async load() {
			return {
				entries: {},
				jobs: [
					{
						id: "job-1",
						op: "upload",
						path: "notes/a.md",
						priority: 1,
						attempt: 2,
						nextRunAt: 123456,
						status: "blocked",
						lastErrorCode: "REMOTE_PATH_CONFLICT",
						lastErrorRetryable: false,
						lastErrorAt: 111111,
					},
				],
				lastErrorAt: 222222,
				lastErrorCode: "AUTH_SESSION_EXPIRED",
				lastErrorCategory: "auth",
				lastErrorRetryable: false,
				logs: [
					{
						at: "2026-03-10T00:00:00.000Z",
						message: "Job blocked by auth",
						context: "auth",
						code: "AUTH_REAUTH_REQUIRED",
						category: "auth",
						retryable: false,
						path: "notes/a.md",
						jobId: "job-1",
						jobOp: "upload",
					},
				],
				runtimeMetrics: {},
			};
		}
	},
}));

describe("exportDiagnostics", () => {
	test("includes structured sync error fields and job error summaries", async () => {
		let writtenPath = "";
		let writtenContent = "";
		const app = {
			vault: {
				adapter: {
					write: async (path: string, content: string) => {
						writtenPath = path;
						writtenContent = content;
					},
				},
			},
		};
		const plugin = {
			loadData: async () => ({
				settings: {
					remoteProviderId: "proton-drive",
					remoteScopeId: "folder-1234567890",
					remoteAccountEmail: "user@example.com",
					remoteProviderCredentials: { token: "secret" },
					remoteHasAuthSession: true,
					syncStrategy: "bidirectional",
					autoSyncEnabled: true,
				},
			}),
		};

		await exportDiagnostics(app as never, plugin as never, "diagnostics.json");

		expect(writtenPath).toBe("diagnostics.json");
		const report = JSON.parse(writtenContent) as {
			settings: {
				accountEmail: string;
			};
			syncState: {
				lastErrorCode?: string;
				lastErrorCategory?: string;
				lastErrorRetryable?: boolean;
				recentErrors: Array<{
					code?: string;
					path?: string;
					jobId?: string;
				}>;
				jobErrors: Array<{
					lastErrorCode?: string;
					lastErrorRetryable?: boolean;
					lastErrorAt?: number;
				}>;
			};
		};
		expect(report.settings.accountEmail).toBe("u***r@e***e.com");
		expect(report.syncState.lastErrorCode).toBe("AUTH_SESSION_EXPIRED");
		expect(report.syncState.lastErrorCategory).toBe("auth");
		expect(report.syncState.lastErrorRetryable).toBe(false);
		expect(report.syncState.jobErrors).toEqual([
			expect.objectContaining({
				lastErrorCode: "REMOTE_PATH_CONFLICT",
				lastErrorRetryable: false,
				lastErrorAt: 111111,
				path: "***.md",
			}),
		]);
		expect(report.syncState.recentErrors).toEqual([
			expect.objectContaining({
				code: "AUTH_REAUTH_REQUIRED",
				path: "***.md",
				jobId: "job-1",
			}),
		]);
	});
});
