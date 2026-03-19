import type { Logger, MetricEvent, Telemetry } from "@protontech/drive-sdk";
import { logger } from "@provider/providers/proton-drive/sdk/logger";

function sanitizeUrl(url: string): string {
	const queryIndex = url.indexOf("?");
	return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function formatMetric(event: MetricEvent): string {
	switch (event.eventName) {
		case "apiRetrySucceeded":
			return `apiRetrySucceeded url=${sanitizeUrl(event.url)} attempts=${event.failedAttempts}`;
		case "debounceLongWait":
			return "debounceLongWait";
		case "upload":
			return `upload size=${event.uploadedSize}/${event.expectedSize} error=${
				event.error ?? "none"
			}`;
		case "download":
			return `download size=${event.downloadedSize}/${event.claimedFileSize ?? "unknown"} error=${
				event.error ?? "none"
			}`;
		case "decryptionError":
			return `decryptionError field=${event.field} uid=${event.uid}`;
		case "verificationError":
			return `verificationError field=${event.field} uid=${event.uid}`;
		case "blockVerificationError":
			return `blockVerificationError retryHelped=${event.retryHelped}`;
		case "volumeEventsSubscriptionsChanged":
			return `volumeEventsSubscriptionsChanged count=${event.numberOfVolumeSubscriptions}`;
		case "performance":
			return `performance type=${event.type} model=${event.cryptoModel} bytes=${event.bytesProcessed} ms=${event.milliseconds}`;
		default: {
			const exhaustive: never = event;
			return `metric ${JSON.stringify(exhaustive)}`;
		}
	}
}

function createNamedLogger(name: string): Logger {
	const prefix = `[sdk:${name}] `;
	return {
		debug(msg: string) {
			logger.debug(`${prefix}${msg}`);
		},
		info(msg: string) {
			logger.info(`${prefix}${msg}`);
		},
		warn(msg: string) {
			logger.warn(`${prefix}${msg}`);
		},
		error(msg: string, error?: unknown) {
			if (error) {
				logger.error(`${prefix}${msg}`, error);
				return;
			}
			logger.error(`${prefix}${msg}`);
		},
	};
}

export function createSdkTelemetry(): Telemetry<MetricEvent> {
	return {
		getLogger(name: string) {
			return createNamedLogger(name);
		},
		recordMetric(event: MetricEvent) {
			logger.debug(`[sdk-metric] ${formatMetric(event)}`);
		},
	};
}
