import type {
	RemoteFileEntry,
	RemoteFileSystem,
	RemoteTreeEvent,
} from "../../filesystem/contracts";
import type { RemoteFileSystemStrategy } from "./contracts";

export type RateLimitedRemoteFileSystemOptions = {
	maxConcurrent?: number;
	minIntervalMs?: number;
	cooldownBaseMs?: number;
	cooldownMaxMs?: number;
	now?: () => number;
	setTimer?: (fn: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
	clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_MIN_INTERVAL_MS = 150;
const DEFAULT_COOLDOWN_BASE_MS = 1000;
const DEFAULT_COOLDOWN_MAX_MS = 30000;

export function createRateLimitedRemoteFileSystemStrategy(
	options: RateLimitedRemoteFileSystemOptions = {},
): RemoteFileSystemStrategy {
	return (remoteFileSystem) => new RateLimitedRemoteFileSystem(remoteFileSystem, options);
}

export class RateLimitedRemoteFileSystem implements RemoteFileSystem {
	private readonly maxConcurrent: number;
	private readonly minIntervalMs: number;
	private readonly cooldownBaseMs: number;
	private readonly cooldownMaxMs: number;
	private readonly now: () => number;
	private readonly setTimer: (fn: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
	private readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;

	private activeTasks = 0;
	private nextStartAt = 0;
	private cooldownUntil = 0;
	private rateLimitFailureStreak = 0;
	private transientFailureStreak = 0;
	private drainTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly taskQueue: Array<() => void> = [];

	constructor(
		private readonly inner: RemoteFileSystem,
		options: RateLimitedRemoteFileSystemOptions = {},
	) {
		this.maxConcurrent = Math.max(1, options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT);
		this.minIntervalMs = Math.max(0, options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS);
		this.cooldownBaseMs = Math.max(0, options.cooldownBaseMs ?? DEFAULT_COOLDOWN_BASE_MS);
		this.cooldownMaxMs = Math.max(
			this.cooldownBaseMs,
			options.cooldownMaxMs ?? DEFAULT_COOLDOWN_MAX_MS,
		);
		this.now = options.now ?? (() => Date.now());
		this.setTimer =
			options.setTimer ??
			((fn, delayMs) => setTimeout(fn, delayMs) as ReturnType<typeof setTimeout>);
		this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
	}

	listEntries(): Promise<RemoteFileEntry[]> {
		return this.schedule(() => this.inner.listEntries());
	}

	listFiles(): Promise<RemoteFileEntry[]> {
		return this.schedule(() => this.inner.listFiles());
	}

	listFolders(): Promise<RemoteFileEntry[]> {
		if (this.inner.listFolders) {
			return this.schedule(() => this.inner.listFolders!());
		}
		return this.schedule(async () => {
			const entries = await this.inner.listEntries();
			return entries.filter((entry) => entry.type === "folder");
		});
	}

	uploadFile(
		path: string,
		data: Uint8Array,
		metadata?: { mtimeMs?: number; size?: number },
	): Promise<{ id?: string; revisionId?: string }> {
		return this.schedule(() => this.inner.uploadFile(path, data, metadata));
	}

	downloadFile(id: string): Promise<Uint8Array> {
		return this.schedule(() => this.inner.downloadFile(id));
	}

	deletePath(id: string): Promise<void> {
		if (!this.inner.deletePath) {
			return Promise.reject(new Error("RemoteFileSystem.deletePath is not implemented."));
		}
		return this.schedule(() => this.inner.deletePath!(id));
	}

	movePath(id: string, newPath: string): Promise<void> {
		if (!this.inner.movePath) {
			return Promise.reject(new Error("RemoteFileSystem.movePath is not implemented."));
		}
		return this.schedule(() => this.inner.movePath!(id, newPath));
	}

	createFolder(path: string): Promise<{ id?: string }> {
		if (!this.inner.createFolder) {
			return Promise.reject(new Error("RemoteFileSystem.createFolder is not implemented."));
		}
		return this.schedule(() => this.inner.createFolder!(path));
	}

	getNode(id: string): Promise<RemoteFileEntry | null> {
		if (!this.inner.getNode) {
			return Promise.resolve(null);
		}
		return this.schedule(() => this.inner.getNode!(id));
	}

	getRootFolder(): Promise<RemoteFileEntry | null> {
		if (!this.inner.getRootFolder) {
			return Promise.resolve(null);
		}
		return this.schedule(() => this.inner.getRootFolder!());
	}

	subscribeToTreeEvents(
		treeEventScopeId: string,
		onEvent: (event: RemoteTreeEvent) => Promise<void>,
	): Promise<{ dispose: () => void }> {
		if (!this.inner.subscribeToTreeEvents) {
			return Promise.reject(
				new Error("RemoteFileSystem.subscribeToTreeEvents is not implemented."),
			);
		}
		// Subscription setup is a one-off control path and should not be queued behind data traffic.
		return this.inner.subscribeToTreeEvents(treeEventScopeId, onEvent);
	}

	private schedule<T>(operation: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.taskQueue.push(() => {
				this.activeTasks += 1;
				this.nextStartAt = Math.max(this.nextStartAt, this.now()) + this.minIntervalMs;
				void operation()
					.then(
						(result) => {
							this.handleOperationSuccess();
							resolve(result);
						},
						(error: unknown) => {
							this.handleOperationError(error);
							reject(error);
						},
					)
					.finally(() => {
						this.activeTasks -= 1;
						this.drainQueue();
					});
			});
			this.drainQueue();
		});
	}

	private drainQueue(): void {
		if (this.activeTasks >= this.maxConcurrent) {
			return;
		}
		const task = this.taskQueue[0];
		if (!task) {
			this.clearDrainTimer();
			return;
		}

		const waitUntil = Math.max(this.nextStartAt, this.cooldownUntil);
		const waitMs = Math.max(0, waitUntil - this.now());
		if (waitMs > 0) {
			this.scheduleDrain(waitMs);
			return;
		}

		this.taskQueue.shift();
		task();
		this.drainQueue();
	}

	private scheduleDrain(delayMs: number): void {
		if (this.drainTimer !== null) {
			return;
		}
		this.drainTimer = this.setTimer(() => {
			this.drainTimer = null;
			this.drainQueue();
		}, delayMs);
	}

	private clearDrainTimer(): void {
		if (this.drainTimer === null) {
			return;
		}
		this.clearTimer(this.drainTimer);
		this.drainTimer = null;
	}

	private handleOperationSuccess(): void {
		this.rateLimitFailureStreak = 0;
		this.transientFailureStreak = 0;
	}

	private handleOperationError(error: unknown): void {
		const signal = classifyFailureSignal(error, this.now());
		if (signal.kind === "none") {
			return;
		}

		if (signal.kind === "rate_limit") {
			this.rateLimitFailureStreak = Math.min(this.rateLimitFailureStreak + 1, 8);
			const computedCooldown =
				signal.retryAfterMs ??
				this.cooldownBaseMs * Math.pow(2, this.rateLimitFailureStreak - 1);
			const cooldownMs = Math.min(computedCooldown, this.cooldownMaxMs);
			this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + cooldownMs);
			return;
		}

		this.transientFailureStreak = Math.min(this.transientFailureStreak + 1, 6);
		const cooldownMs = Math.min(
			this.cooldownBaseMs * Math.pow(2, this.transientFailureStreak - 1),
			this.cooldownMaxMs,
		);
		this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + cooldownMs);
	}
}

type FailureSignal =
	| { kind: "none" }
	| { kind: "rate_limit"; retryAfterMs?: number }
	| { kind: "transient" };

function classifyFailureSignal(error: unknown, nowMs: number): FailureSignal {
	const status = extractStatusCode(error);
	if (status === 429) {
		return {
			kind: "rate_limit",
			retryAfterMs: extractRetryAfterMs(error, nowMs),
		};
	}
	if (
		status === 408 ||
		status === 425 ||
		status === 500 ||
		status === 502 ||
		status === 503 ||
		status === 504
	) {
		return { kind: "transient" };
	}

	const message = normalizeErrorMessage(error);
	if (
		message.includes("rate limit") ||
		message.includes("too many") ||
		message.includes("throttle") ||
		message.includes("429")
	) {
		return {
			kind: "rate_limit",
			retryAfterMs: extractRetryAfterMs(error, nowMs),
		};
	}
	if (
		message.includes("network") ||
		message.includes("timeout") ||
		message.includes("temporar") ||
		message.includes("503") ||
		message.includes("502") ||
		message.includes("500")
	) {
		return { kind: "transient" };
	}
	return { kind: "none" };
}

function extractStatusCode(error: unknown): number | undefined {
	if (!error || typeof error !== "object") {
		return undefined;
	}
	const record = error as {
		status?: unknown;
		response?: {
			status?: unknown;
		};
	};
	if (typeof record.status === "number") {
		return record.status;
	}
	if (typeof record.response?.status === "number") {
		return record.response.status;
	}
	return undefined;
}

function extractRetryAfterMs(error: unknown, nowMs: number): number | undefined {
	if (!error || typeof error !== "object") {
		return undefined;
	}
	const record = error as {
		retryAfterMs?: unknown;
		response?: {
			headers?: {
				get?: (name: string) => string | null;
			};
		};
		message?: unknown;
	};

	if (typeof record.retryAfterMs === "number" && record.retryAfterMs > 0) {
		return record.retryAfterMs;
	}
	const retryAfterHeader = record.response?.headers?.get?.("retry-after");
	if (typeof retryAfterHeader === "string") {
		const parsedHeader = parseRetryAfterValue(retryAfterHeader, nowMs);
		if (typeof parsedHeader === "number" && parsedHeader > 0) {
			return parsedHeader;
		}
	}
	if (typeof record.message === "string") {
		const parsedMessage = parseRetryAfterFromMessage(record.message, nowMs);
		if (typeof parsedMessage === "number" && parsedMessage > 0) {
			return parsedMessage;
		}
	}
	return undefined;
}

function parseRetryAfterValue(value: string, nowMs: number): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	const seconds = Number(trimmed);
	if (Number.isFinite(seconds) && seconds > 0) {
		return Math.round(seconds * 1000);
	}
	const asDate = Date.parse(trimmed);
	if (!Number.isNaN(asDate) && asDate > nowMs) {
		return asDate - nowMs;
	}
	return undefined;
}

function parseRetryAfterFromMessage(message: string, nowMs: number): number | undefined {
	const msMatch = /retry[-\s]?after[:=\s]+(\d+)\s*(ms|millisecond|milliseconds)\b/i.exec(message);
	if (msMatch?.[1]) {
		return Number(msMatch[1]);
	}
	const secondsMatch = /retry[-\s]?after[:=\s]+(\d+)\s*(s|sec|secs|second|seconds)?\b/i.exec(
		message,
	);
	if (secondsMatch?.[1]) {
		return Number(secondsMatch[1]) * 1000;
	}
	const dateMatch = /retry[-\s]?after[:=\s]+([A-Za-z]{3},[^\n]+)/i.exec(message);
	if (dateMatch?.[1]) {
		const asDate = Date.parse(dateMatch[1].trim());
		if (!Number.isNaN(asDate) && asDate > nowMs) {
			return asDate - nowMs;
		}
	}
	return undefined;
}

function normalizeErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message.toLowerCase();
	}
	if (typeof error === "string") {
		return error.toLowerCase();
	}
	return "";
}
