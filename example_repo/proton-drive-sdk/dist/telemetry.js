"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicLogFormatter = exports.JSONLogFormatter = exports.MemoryLogHandler = exports.ConsoleLogHandler = exports.LogFilter = exports.LoggerWithPrefix = exports.Telemetry = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARNING"] = "WARNING";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Telemetry class that logs messages and metrics.
 *
 * Example:
 *
 * ```typescript
 * const memoryLogHandler = new MemoryLogHandler();
 *
 * interface MetricEvents = {
 *    name: string,
 *    value: number,
 * }
 * class OwnMetricHandler implements MetricHandler<MetricEvents> {
 *    onEvent(metric: MetricRecord<MetricEvents>) {
 *        // Process metric event
 *    }
 * }
 *
 * const telemetry = new Telemetry<MetricEvents>({
 *    // Enable debug logging
 *    logFilter: new LogFilter({ level: LogLevel.DEBUG }),
 *    // Log to console and memory
 *    logHandlers: [new ConsoleLogHandler(), memoryLogHandler],
 *    // Log to console and own handler to process further
 *    metricHandlers: [new ConsoleMetricHandler(), ownMetricHandler],
 * });
 *
 * const logger = telemetry.getLogger('myLogger');
 * logger.debug('Debug message');
 *
 * telemetry.recordMetric({ name: 'somethingHappened', value: 42 });
 *
 * const logs = memoryLogHandler.getLogs();
 * // Process logs
 * ```
 *
 * @param logFilter - Log filter to filter logs based on log level, default INFO
 * @param logHandlers - Log handlers to use for logging, see LogHandler implementations
 * @param metricHandlers - Metric handlers to use for logging, see MetricHandler implementations
 */
class Telemetry {
    logFilter;
    logHandlers;
    metricHandlers;
    constructor(options) {
        this.logFilter = options?.logFilter || new LogFilter();
        this.logHandlers = options?.logHandlers || [new ConsoleLogHandler()];
        this.metricHandlers = options?.metricHandlers || [new ConsoleMetricHandler()];
    }
    getLogger(name) {
        return new Logger(name, this.logFilter, this.logHandlers);
    }
    recordMetric(event) {
        const metric = {
            time: new Date(),
            event,
        };
        this.metricHandlers.forEach((handler) => handler.onEvent(metric));
    }
}
exports.Telemetry = Telemetry;
/**
 * Logger class that logs messages with different levels.
 *
 * @param name - Name of the logger
 * @param handlers - Log handlers to use for logging, see LogHandler implementations
 */
class Logger {
    name;
    filter;
    handlers;
    constructor(name, filter, handlers) {
        this.name = name;
        this.filter = filter;
        this.handlers = handlers;
        this.name = name;
        this.filter = filter;
        this.handlers = handlers;
    }
    debug(message) {
        this.log({
            time: new Date(),
            level: LogLevel.DEBUG,
            loggerName: this.name,
            message,
        });
    }
    info(message) {
        this.log({
            time: new Date(),
            level: LogLevel.INFO,
            loggerName: this.name,
            message,
        });
    }
    warn(message) {
        this.log({
            time: new Date(),
            level: LogLevel.WARNING,
            loggerName: this.name,
            message,
        });
    }
    error(message, error) {
        this.log({
            time: new Date(),
            level: LogLevel.ERROR,
            loggerName: this.name,
            message,
            error,
        });
    }
    log(log) {
        if (!this.filter.filter(log)) {
            return;
        }
        this.handlers.forEach((handler) => handler.log(log));
    }
}
/**
 * Logger class that logs messages with a prefix.
 *
 * Example:
 *
 * ```typescript
 * const logger = new Logger('myLogger', new LogFilter(), [new ConsoleLogHandler()]);
 * const loggerWithPrefix = new LoggerWithPrefix(logger, 'prefix');
 * loggerWithPrefix.info('Info message');
 * ```
 */
class LoggerWithPrefix {
    logger;
    prefix;
    constructor(logger, prefix) {
        this.logger = logger;
        this.prefix = prefix;
        this.logger = logger;
        this.prefix = prefix;
    }
    info(message) {
        this.logger.info(`${this.prefix}: ${message}`);
    }
    debug(message) {
        this.logger.debug(`${this.prefix}: ${message}`);
    }
    warn(message) {
        this.logger.warn(`${this.prefix}: ${message}`);
    }
    error(message, error) {
        this.logger.error(`${this.prefix}: ${message}`, error);
    }
}
exports.LoggerWithPrefix = LoggerWithPrefix;
/**
 * Filter logs based on log level. It can be configured by global level or
 * per logger level.
 *
 * @param globalLevel - Global log level, default INFO
 * @param loggerLevels - Log levels for specific loggers, default empty
 */
class LogFilter {
    logLevelMap = {
        DEBUG: 0,
        INFO: 1,
        WARNING: 2,
        ERROR: 3,
    };
    globalLevel;
    loggerLevels;
    constructor(options) {
        this.globalLevel = this.logLevelMap[options?.globalLevel || LogLevel.INFO];
        this.loggerLevels = Object.fromEntries(Object.entries(options?.loggerLevels || {}).map(([loggerName, level]) => [
            loggerName,
            this.logLevelMap[level],
        ]));
    }
    /**
     * @returns False if the log should be ignored.
     */
    filter(log) {
        const logLevel = this.logLevelMap[log.level];
        if (logLevel < this.globalLevel) {
            return false;
        }
        const loggerLevel = this.loggerLevels[log.loggerName] || 0;
        if (logLevel < loggerLevel) {
            return false;
        }
        return true;
    }
}
exports.LogFilter = LogFilter;
/**
 * Log handler that logs to console.
 *
 * @param formatter - Formatter to use for log messages, default BasicLogFormatter
 */
class ConsoleLogHandler {
    logLevelMap = {
        DEBUG: console.debug, // eslint-disable-line no-console
        INFO: console.info, // eslint-disable-line no-console
        WARNING: console.warn, // eslint-disable-line no-console
        ERROR: console.error, // eslint-disable-line no-console
    };
    formatter;
    constructor(formatter) {
        this.formatter = formatter || new BasicLogFormatter();
    }
    log(log) {
        const message = this.formatter.format(log);
        this.logLevelMap[log.level](message);
    }
}
exports.ConsoleLogHandler = ConsoleLogHandler;
/**
 * Log handler that stores logs in memory with option to retrieve later.
 *
 * Useful for keeping logs around and retrieve them on demand when an error
 * occures.
 *
 * @param formatter - Formatter to use for log messages, default JSONLogFormatter
 * @param maxLogs - Maximum number of logs to store, default 10000
 */
class MemoryLogHandler {
    maxLogs;
    logs = [];
    formatter;
    constructor(formatter, maxLogs = 10000) {
        this.maxLogs = maxLogs;
        this.formatter = formatter || new JSONLogFormatter();
        this.maxLogs = maxLogs;
    }
    log(log) {
        const message = this.formatter.format(log);
        this.logs.push(message);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }
    getLogs() {
        return this.logs;
    }
    clear() {
        this.logs = [];
    }
}
exports.MemoryLogHandler = MemoryLogHandler;
/**
 * Formatter that formats logs as JSON.
 *
 * Useful for machine processing.
 */
class JSONLogFormatter {
    format(log) {
        if (log.error instanceof Error) {
            return JSON.stringify({
                ...log,
                error: log.error.message,
                stack: log.error.stack,
            });
        }
        return JSON.stringify(log);
    }
}
exports.JSONLogFormatter = JSONLogFormatter;
/**
 * Formatter that formats logs as plain text.
 *
 * Useful for human reading.
 */
class BasicLogFormatter {
    format(log) {
        let errorDetails = '';
        if (log.error) {
            errorDetails =
                log.error instanceof Error
                    ? `\nError: ${log.error.message}\nStack:\n${log.error.stack}`
                    : `\nError: ${log.error}`;
        }
        return `${log.time.toISOString()} ${log.level} [${log.loggerName}] ${log.message}${errorDetails}`;
    }
}
exports.BasicLogFormatter = BasicLogFormatter;
class ConsoleMetricHandler {
    onEvent(metric) {
        // eslint-disable-next-line no-console
        console.info(`${metric.time.toISOString()} INFO [metric] ${metric.event.eventName} ${JSON.stringify({ ...metric.event, name: undefined })}`);
    }
}
//# sourceMappingURL=telemetry.js.map