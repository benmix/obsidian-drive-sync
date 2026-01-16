import { MetricEvent } from '../interface';
import { LogRecord } from '../telemetry';
import { EventsGenerator } from './eventsGenerator';
/**
 * Special telemetry that is compatible with the SDK.
 *
 * It is a probe into SDK to observe whats going on and report any suspicious
 * behavior.
 *
 * It should be used only for diagnostic purposes.
 */
export declare class DiagnosticTelemetry extends EventsGenerator {
    getLogger(name: string): Logger;
    recordMetric(event: MetricEvent): void;
}
declare class Logger {
    private name;
    private callback?;
    constructor(name: string, callback?: ((log: LogRecord) => void) | undefined);
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
}
export {};
