export type ProtonLogLevel = "debug" | "info" | "warn" | "error";

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

export const logger = {
	debug(message: string, ...args: unknown[]) {
		if (order[current] <= order.debug) {
			console.debug(message, ...args);
		}
	},
	info(message: string, ...args: unknown[]) {
		if (order[current] <= order.info) {
			console.info(message, ...args);
		}
	},
	warn(message: string, ...args: unknown[]) {
		if (order[current] <= order.warn) {
			console.warn(message, ...args);
		}
	},
	error(message: string, ...args: unknown[]) {
		if (order[current] <= order.error) {
			console.error(message, ...args);
		}
	},
};
