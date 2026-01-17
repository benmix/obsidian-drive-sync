import type { SyncEntry, SyncJob } from "../data/sync-schema";

export type SyncState = {
	entries: Record<string, SyncEntry>;
	jobs: SyncJob[];
	lastSyncAt?: number;
	lastError?: string;
	lastErrorAt?: number;
	remoteEventCursor?: string;
	logs?: Array<{ at: string; message: string; context?: string }>;
};

export const DEFAULT_SYNC_STATE: SyncState = {
	entries: {},
	jobs: [],
	logs: [],
};

export class SyncIndexStore {
	private state: SyncState;

	constructor(initial?: SyncState) {
		this.state = initial ?? { entries: {}, jobs: [], logs: [] };
	}

	getEntry(path: string): SyncEntry | undefined {
		return this.state.entries[path];
	}

	setEntry(entry: SyncEntry): void {
		this.state.entries[entry.relPath] = entry;
	}

	removeEntry(path: string): void {
		delete this.state.entries[path];
	}

	listEntries(): SyncEntry[] {
		return Object.values(this.state.entries);
	}

	addJob(job: SyncJob): void {
		this.state.jobs.push(job);
	}

	listJobs(): SyncJob[] {
		return [...this.state.jobs];
	}

	clearJobs(): void {
		this.state.jobs = [];
	}

	removeJob(jobId: string): void {
		this.state.jobs = this.state.jobs.filter((job) => job.id !== jobId);
	}

	toJSON(): SyncState {
		return {
			entries: { ...this.state.entries },
			jobs: [...this.state.jobs],
			lastSyncAt: this.state.lastSyncAt,
			lastError: this.state.lastError,
			lastErrorAt: this.state.lastErrorAt,
			remoteEventCursor: this.state.remoteEventCursor,
			logs: [...(this.state.logs ?? [])],
		};
	}

	setLastSyncAt(timestamp: number): void {
		this.state.lastSyncAt = timestamp;
	}

	setLastError(lastError?: string, lastErrorAt?: number): void {
		this.state.lastError = lastError;
		this.state.lastErrorAt = lastErrorAt;
	}

	setRemoteEventCursor(cursor?: string): void {
		this.state.remoteEventCursor = cursor;
	}

	addLog(message: string, context?: string): void {
		const entry = {
			at: new Date().toISOString(),
			message,
			context,
		};
		this.state.logs = [...(this.state.logs ?? []), entry].slice(-200);
	}
}
