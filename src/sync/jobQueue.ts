import type { SyncJob } from "./indexTypes";

export class SyncJobQueue {
	private jobs: SyncJob[];

	constructor(jobs: SyncJob[] = []) {
		this.jobs = [...jobs];
	}

	enqueue(job: SyncJob): void {
		if (this.jobs.some((existing) => existing.id === job.id)) {
			return;
		}
		this.jobs.push(job);
		this.sort();
	}

	enqueueMany(jobs: SyncJob[]): void {
		const existing = new Set(this.jobs.map((job) => job.id));
		for (const job of jobs) {
			if (existing.has(job.id)) {
				continue;
			}
			this.jobs.push(job);
		}
		this.sort();
	}

	next(): SyncJob | undefined {
		return this.jobs.shift();
	}

	peek(): SyncJob | undefined {
		return this.jobs[0];
	}

	clear(): void {
		this.jobs = [];
	}

	list(): SyncJob[] {
		return [...this.jobs];
	}

	private sort(): void {
		this.jobs.sort(
			(a, b) => a.priority - b.priority || a.nextRunAt - b.nextRunAt,
		);
	}
}
