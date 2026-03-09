import type { LocalFileSystem, RemoteFileSystem } from "../../contracts/filesystem/file-system";
import { type SyncRunRequest } from "../../contracts/sync/run-request";
import { type StateStore } from "../../contracts/sync/state-store";
import { DEFAULT_SYNC_STRATEGY, type SyncStrategy } from "../../contracts/sync/strategy";
import { SyncEngine } from "../engine/sync-engine";
import { isInitializationPhase } from "../planner/initialization";
import { filterLocalChanges } from "../planner/local-change-filter";
import { planLocalChanges } from "../planner/local-change-planner";
import { pollRemoteChanges } from "../planner/remote-poller";
import { now } from "../support/utils";

const BACKGROUND_RECONCILE_INTERVAL_MS = 15 * 60 * 1000;

type SyncRunContext = {
	localFileSystem: LocalFileSystem;
	remoteFileSystem: RemoteFileSystem;
	syncStrategy: SyncStrategy;
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
				syncStrategy: context.syncStrategy ?? DEFAULT_SYNC_STRATEGY,
				onAuthError: context.onAuthError,
			},
		);
		await engine.load();
		const initialState = engine.getStateSnapshot();
		const filteredLocalChanges =
			request.localChanges.length > 0
				? await filterLocalChanges(
						request.localChanges,
						initialState,
						context.localFileSystem,
					)
				: [];
		let localEntryCount: number | null = null;
		const getLocalEntryCount = async (): Promise<number> => {
			if (localEntryCount !== null) {
				return localEntryCount;
			}
			localEntryCount = (await context.localFileSystem.listEntries()).length;
			return localEntryCount;
		};
		const shouldPreferRemoteSeed = async (): Promise<boolean> => {
			const state = engine.getStateSnapshot();
			if (!isInitializationPhase(state)) {
				return false;
			}
			return (await getLocalEntryCount()) === 0;
		};

		if (filteredLocalChanges.length > 0) {
			const plan = planLocalChanges(filteredLocalChanges, engine.getStateSnapshot());
			engine.applyEntries(plan.entries);
			engine.removeEntries(plan.removedPaths);
			if (plan.rewritePrefixes.length > 0) {
				engine.rewritePaths(plan.rewritePrefixes);
			}
			for (const job of plan.jobs) {
				engine.enqueue(job);
			}
		}

		if (request.trigger !== "local" || filteredLocalChanges.length === 0 || shouldReconcile) {
			const remotePlan = await pollRemoteChanges(
				context.remoteFileSystem,
				engine.getStateSnapshot(),
				{
					syncStrategy: context.syncStrategy,
					preferRemoteSeed: await shouldPreferRemoteSeed(),
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
			const reconcile = await engine.plan({
				preferRemoteSeed: await shouldPreferRemoteSeed(),
			});
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
