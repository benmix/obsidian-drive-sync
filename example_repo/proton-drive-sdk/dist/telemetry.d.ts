import { Logger as LoggerInterface } from './interface';
export interface LogRecord {
    time: Date;
    level: LogLevel;
    loggerName: string;
    message: string;
    error?: unknown;
}
export declare enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR"
}
export interface LogFormatter {
    format(log: LogRecord): string;
}
export interface LogHandler {
    log(log: LogRecord): void;
}
export interface MetricRecord<T extends MetricEvent> {
    time: Date;
    event: T;
}
export type MetricEvent = {
    eventName: string;
};
export interface MetricHandler<T extends MetricEvent> {
    onEvent(metric: MetricRecord<T>): void;
}
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
export declare class Telemetry<T extends MetricEvent> {
    private logFilter;
    private logHandlers;
    private metricHandlers;
    constructor(options?: {
        logFilter?: LogFilter;
        logHandlers?: LogHandler[];
        metricHandlers?: MetricHandler<T>[];
    });
    getLogger(name: string): Logger;
    recordMetric(event: T): void;
}
/**
 * Logger class that logs messages with different levels.
 *
 * @param name - Name of the logger
 * @param handlers - Log handlers to use for logging, see LogHandler implementations
 */
declare class Logger {
    private name;
    private filter;
    private handlers;
    constructor(name: string, filter: LogFilter, handlers: LogHandler[]);
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
    private log;
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
export declare class LoggerWithPrefix {
    private logger;
    private prefix;
    constructor(logger: LoggerInterface, prefix: string);
    info(message: string): void;
    debug(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
}
/**
 * Filter logs based on log level. It can be configured by global level or
 * per logger level.
 *
 * @param globalLevel - Global log level, default INFO
 * @param loggerLevels - Log levels for specific loggers, default empty
 */
export declare class LogFilter {
    private logLevelMap;
    private globalLevel;
    private loggerLevels;
    constructor(options?: {
        globalLevel?: LogLevel;
        loggerLevels?: {
            [loggerName: string]: LogLevel;
        };
    });
    /**
     * @returns False if the log should be ignored.
     */
    filter(log: LogRecord): boolean;
}
/**
 * Log handler that logs to console.
 *
 * @param formatter - Formatter to use for log messages, default BasicLogFormatter
 */
export declare class ConsoleLogHandler implements LogHandler {
    private logLevelMap;
    private formatter;
    constructor(formatter?: LogFormatter);
    log(log: LogRecord): void;
}
/**
 * Log handler that stores logs in memory with option to retrieve later.
 *
 * Useful for keeping logs around and retrieve them on demand when an error
 * occures.
 *
 * @param formatter - Formatter to use for log messages, default JSONLogFormatter
 * @param maxLogs - Maximum number of logs to store, default 10000
 */
export declare class MemoryLogHandler implements LogHandler {
    private maxLogs;
    private logs;
    private formatter;
    constructor(formatter?: LogFormatter, maxLogs?: number);
    log(log: LogRecord): void;
    getLogs(): string[];
    clear(): void;
}
/**
 * Formatter that formats logs as JSON.
 *
 * Useful for machine processing.
 */
export declare class JSONLogFormatter implements LogFormatter {
    format(log: LogRecord): string;
}
/**
 * Formatter that formats logs as plain text.
 *
 * Useful for human reading.
 */
export declare class BasicLogFormatter implements LogFormatter {
    format(log: LogRecord): string;
}
export {};
