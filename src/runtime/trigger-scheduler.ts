import {
	INTERNAL_AUTO_SYNC_INTERVAL_MS,
	INTERNAL_LOCAL_CHANGE_DEBOUNCE_MS,
} from "../internal-config";
import { type SyncRunRequest, type SyncRunTrigger } from "../sync/contracts/types";
import { type LocalChange } from "../filesystem/contracts";
import { type LocalChangeWatcher } from "../provider/contracts";

type TriggerSchedulerOptions = {
	createLocalWatcher: (
		onChange: (change: LocalChange) => void,
		debounceMs: number,
	) => LocalChangeWatcher;
	registerInterval: (intervalId: number) => void;
	isAutoSyncEnabled: () => boolean;
	isAutoSyncPaused: () => boolean;
	isAuthPaused: () => boolean;
	onRunRequest: (request: SyncRunRequest) => Promise<void>;
};

export class TriggerScheduler {
	private autoSyncIntervalId: number | null = null;
	private localWatcher: LocalChangeWatcher | null = null;
	private localChangeQueue: LocalChange[] = [];
	private localRunTimeout: number | null = null;
	private syncRunning = false;
	private syncPending = false;

	constructor(private readonly options: TriggerSchedulerOptions) {}

	start(): void {
		this.localWatcher = this.options.createLocalWatcher(
			(change) => this.handleLocalChange(change),
			INTERNAL_LOCAL_CHANGE_DEBOUNCE_MS,
		);
		this.localWatcher.start();

		this.autoSyncIntervalId = window.setInterval(() => {
			void this.run("interval", false);
		}, INTERNAL_AUTO_SYNC_INTERVAL_MS);
		this.options.registerInterval(this.autoSyncIntervalId);

		this.scheduleRun(0, "interval");
	}

	stop(): void {
		if (this.autoSyncIntervalId !== null) {
			window.clearInterval(this.autoSyncIntervalId);
			this.autoSyncIntervalId = null;
		}
		if (this.localRunTimeout !== null) {
			window.clearTimeout(this.localRunTimeout);
			this.localRunTimeout = null;
		}
		if (this.localWatcher) {
			this.localWatcher.stop();
			this.localWatcher = null;
		}
		this.localChangeQueue = [];
		this.syncRunning = false;
		this.syncPending = false;
	}

	async runManual(force = false): Promise<void> {
		await this.run("manual", force);
	}

	scheduleManualRun(): void {
		this.scheduleRun(0, "manual");
	}

	isSyncRunning(): boolean {
		return this.syncRunning;
	}

	private handleLocalChange(change: LocalChange): void {
		this.localChangeQueue.push(change);
		this.scheduleRun(Math.max(500, INTERNAL_LOCAL_CHANGE_DEBOUNCE_MS), "local");
	}

	private scheduleRun(delayMs: number, trigger: SyncRunTrigger): void {
		if (
			!this.options.isAutoSyncEnabled() ||
			this.options.isAutoSyncPaused() ||
			this.options.isAuthPaused()
		) {
			return;
		}
		if (this.localRunTimeout !== null) {
			return;
		}
		this.localRunTimeout = window.setTimeout(() => {
			this.localRunTimeout = null;
			void this.run(trigger, false);
		}, delayMs);
	}

	private drainLocalChanges(): LocalChange[] {
		const changes = this.localChangeQueue;
		this.localChangeQueue = [];
		return changes;
	}

	private async run(trigger: SyncRunTrigger, force: boolean): Promise<void> {
		if (this.syncRunning) {
			this.syncPending = true;
			return;
		}

		this.syncRunning = true;
		const localChanges = this.drainLocalChanges();

		try {
			await this.options.onRunRequest({
				trigger,
				force,
				localChanges,
			});
		} finally {
			this.syncRunning = false;
			if (this.syncPending) {
				this.syncPending = false;
				void this.run("interval", false);
			}
		}
	}
}
