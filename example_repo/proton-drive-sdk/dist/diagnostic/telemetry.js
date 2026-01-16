"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticTelemetry = void 0;
const telemetry_1 = require("../telemetry");
const eventsGenerator_1 = require("./eventsGenerator");
/**
 * Special telemetry that is compatible with the SDK.
 *
 * It is a probe into SDK to observe whats going on and report any suspicious
 * behavior.
 *
 * It should be used only for diagnostic purposes.
 */
class DiagnosticTelemetry extends eventsGenerator_1.EventsGenerator {
    getLogger(name) {
        return new Logger(name, (log) => {
            this.enqueueEvent({
                type: log.level === telemetry_1.LogLevel.ERROR ? 'log_error' : 'log_warning',
                log,
            });
        });
    }
    recordMetric(event) {
        if (event.eventName === 'download' && !event.error) {
            return;
        }
        if (event.eventName === 'volumeEventsSubscriptionsChanged') {
            return;
        }
        this.enqueueEvent({
            type: 'metric',
            event,
        });
    }
}
exports.DiagnosticTelemetry = DiagnosticTelemetry;
class Logger {
    name;
    callback;
    constructor(name, callback) {
        this.name = name;
        this.callback = callback;
        this.name = name;
        this.callback = callback;
    }
    // Debug or info logs are excluded from the diagnostic.
    // These logs should not include any suspicious behavior.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    debug(message) { }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    info(message) { }
    warn(message) {
        this.callback?.({
            time: new Date(),
            level: telemetry_1.LogLevel.WARNING,
            loggerName: this.name,
            message,
        });
    }
    error(message, error) {
        this.callback?.({
            time: new Date(),
            level: telemetry_1.LogLevel.ERROR,
            loggerName: this.name,
            message,
            error,
        });
    }
}
//# sourceMappingURL=telemetry.js.map