import type { LocalFileSystem, RemoteFileSystem } from "../../filesystem/contracts";
import { now } from "../support/utils";
import { planLocalChanges } from "../planner/local-change-planner";
import { pollRemoteChanges } from "../planner/remote-poller";
import { type StateStore } from "../state/state-store";
import { SyncEngine } from "../engine/sync-engine";
import { type SyncRunRequest } from "../contracts/types";

const BACKGROUND_RECONCILE_INTERVAL_MS = 15 * 60 * 1000;

type ConflictStrategy = "local-wins" | "remote-wins" | "manual";

type SyncRunContext = {
	localFileSystem: LocalFileSystem;
	remoteFileSystem: RemoteFileSystem;
	conflictStrategy: ConflictStrategy;
	onAuthError?: (message: string) => void;
};

type SyncRunnerOptions = {
	now?: () => number;
	backgroundReconcileIntervalMs?: number;
};

export class SyncRunner {
	private lastBackgroundReconcileAt = 0;
	private readonly nowFn: () => number;
	private readonly backgroundReconcileIntervalMs: number;

	constructor(
		private readonly stateStore: StateStore,
		options: SyncRunnerOptions = {},
	) {
		this.nowFn = options.now ?? now;
		this.backgroundReconcileIntervalMs =
			options.backgroundReconcileIntervalMs ?? BACKGROUND_RECONCILE_INTERVAL_MS;
	}

	async run(request: SyncRunRequest, context: SyncRunContext): Promise<void> {
		const nowTs = this.nowFn();
		const shouldReconcile =
			request.force ||
			nowTs - this.lastBackgroundReconcileAt > this.backgroundReconcileIntervalMs;
		const engine = new SyncEngine(
			context.localFileSystem,
			context.remoteFileSystem,
			this.stateStore,
			{
				conflictStrategy: context.conflictStrategy,
				onAuthError: context.onAuthError,
			},
		);
		await engine.load();

		if (request.localChanges.length > 0) {
			const plan = planLocalChanges(request.localChanges, engine.getStateSnapshot());
			engine.applyEntries(plan.entries);
			engine.removeEntries(plan.removedPaths);
			if (plan.rewritePrefixes.length > 0) {
				engine.rewritePaths(plan.rewritePrefixes);
			}
			for (const job of plan.jobs) {
				engine.enqueue(job);
			}
		}

		if (request.trigger !== "local" || request.localChanges.length === 0 || shouldReconcile) {
			const remotePlan = await pollRemoteChanges(
				context.remoteFileSystem,
				engine.getStateSnapshot(),
				{
					conflictStrategy: context.conflictStrategy,
				},
			);
			engine.applyEntries(remotePlan.snapshot);
			engine.removeEntries(remotePlan.removedPaths);
			for (const job of remotePlan.jobs) {
				engine.enqueue(job);
			}
			if (remotePlan.remoteEventCursor) {
				await engine.save({
					remoteEventCursor: remotePlan.remoteEventCursor,
				});
			}
		}

		if (shouldReconcile) {
			const reconcile = await engine.plan();
			if (reconcile.jobsPlanned > 0) {
				this.lastBackgroundReconcileAt = nowTs;
			}
		}

		if (engine.listJobs().length === 0) {
			await engine.save({
				lastError: undefined,
				lastErrorAt: undefined,
			});
			return;
		}

		await engine.runOnce();
		if (shouldReconcile) {
			this.lastBackgroundReconcileAt = nowTs;
		}
	}
}
