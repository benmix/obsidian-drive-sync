import type { SyncEntry, SyncJob, SyncState } from "./index-types";

export class SyncIndexStore {
	private state: SyncState;

	constructor(initial?: SyncState) {
		this.state = initial ?? { entries: {}, jobs: [] };
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
		};
	}

	setLastSyncAt(timestamp: number): void {
		this.state.lastSyncAt = timestamp;
	}

	setLastError(lastError?: string, lastErrorAt?: number): void {
		this.state.lastError = lastError;
		this.state.lastErrorAt = lastErrorAt;
	}
}
