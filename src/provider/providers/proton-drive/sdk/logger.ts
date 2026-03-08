import type { ProtonLogLevel } from "../../../../contracts/provider/proton/log-level";

const order: Record<ProtonLogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

let current: ProtonLogLevel = "info";

export function setProtonLogLevel(level: ProtonLogLevel): void {
	current = level;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TOKEN_RE = /[A-Za-z0-9_-]{20,}/g;

function redactText(input: string): string {
	return input.replace(EMAIL_RE, "***@***").replace(TOKEN_RE, "***");
}

function sanitizeArgs(args: unknown[]): unknown[] {
	return args.map((arg) => {
		if (typeof arg === "string") {
			return redactText(arg);
		}
		if (arg instanceof Error) {
			return redactText(arg.message);
		}
		return arg;
	});
}

export const logger = {
	debug(message: string, ...args: unknown[]) {
		if (order[current] <= order.debug) {
			console.debug(redactText(message), ...sanitizeArgs(args));
		}
	},
	info(message: string, ...args: unknown[]) {
		if (order[current] <= order.info) {
			console.info(redactText(message), ...sanitizeArgs(args));
		}
	},
	warn(message: string, ...args: unknown[]) {
		if (order[current] <= order.warn) {
			console.warn(redactText(message), ...sanitizeArgs(args));
		}
	},
	error(message: string, ...args: unknown[]) {
		if (order[current] <= order.error) {
			console.error(redactText(message), ...sanitizeArgs(args));
		}
	},
};
