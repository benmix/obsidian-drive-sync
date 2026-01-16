"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveAPIService = void 0;
const ttag_1 = require("ttag");
const version_1 = require("../../version");
const errors_1 = require("../../errors");
const wait_1 = require("../wait");
const errorCodes_1 = require("./errorCodes");
const errors_2 = require("./errors");
/**
 * The default timeout in milliseconds for all API requests (metadata).
 */
const DEFAULT_TIMEOUT_MS = 30000;
/**
 * The default timeout in milliseconds for all storage requests (file content).
 */
const DEFAULT_STORAGE_TIMEOUT_MS = 600_000;
/**
 * Maximum number of retry attempts for a timeout error.
 */
const MAX_TIMEOUT_ERROR_RETRY_ATTEMPTS = 3;
/**
 * How many subsequent 429 errors are allowed before we stop further requests.
 */
const TOO_MANY_SUBSEQUENT_429_ERRORS = 50;
/**
 * For how long the API service should cool down after reaching the limit
 * of subsequent 429 errors.
 */
const TOO_MANY_SUBSEQUENT_429_ERRORS_TIMEOUT_IN_SECONDS = 60;
/**
 * How many subsequent 5xx errors are allowed before we stop further requests.
 */
const TOO_MANY_SUBSEQUENT_SERVER_ERRORS = 10;
/**
 * For how long the API service should cool down after reaching the limit
 * of subsequent 5xx errors.
 */
const TOO_MANY_SUBSEQUENT_SERVER_ERRORS_TIMEOUT_IN_SECONDS = 60;
/**
 * How many subsequent offline errors are allowed before we consider the client offline.
 */
const TOO_MANY_SUBSEQUENT_OFFLINE_ERRORS = 10;
/**
 * After how long to re-try after 5xx or timeout error.
 */
const SERVER_ERROR_RETRY_DELAY_SECONDS = 1;
/**
 * After how long to re-try after offline error.
 */
const OFFLINE_RETRY_DELAY_SECONDS = 5;
/**
 * After how long to re-try after 429 error without specified retry-after header.
 */
const DEFAULT_429_RETRY_DELAY_SECONDS = 10;
/**
 * After how long to re-try after general error.
 */
const GENERAL_RETRY_DELAY_SECONDS = 1;
/**
 * Provides API communication used withing the Drive SDK.
 *
 * The service is responsible for handling general headers, errors, conversion,
 * rate limiting, or basic re-tries.
 *
 * Error handling includes:
 *
 * * exception from HTTP client
 *   * retry on offline exc. (with delay from OFFLINE_RETRY_DELAY_SECONDS)
 *   * retry on timeout exc. (with delay from SERVER_ERROR_RETRY_DELAY_SECONDS)
 *   * retry ONCE on any exc. (with delay from GENERAL_RETRY_DELAY_SECONDS)
 * * HTTP status 429
 *   * retry (with delay from `retry-after` header or DEFAULT_429_RETRY_DELAY_SECONDS)
 *   * if too many subsequent 429s, stop further requests (defined in TOO_MANY_SUBSEQUENT_429_ERRORS)
 *   * when limit is reached, cool down for TOO_MANY_SUBSEQUENT_429_ERRORS_TIMEOUT_IN_SECONDS
 * * HTTP status 5xx
 *   * retry ONCE (with delay from SERVER_ERROR_RETRY_DELAY_SECONDS)
 *   * if too many subsequent 5xxs, stop further requests (defined in TOO_MANY_SUBSEQUENT_SERVER_ERRORS)
 *   * when limit is reached, cool down for TOO_MANY_SUBSEQUENT_SERVER_ERRORS_TIMEOUT_IN_SECONDS
 */
class DriveAPIService {
    telemetry;
    sdkEvents;
    httpClient;
    baseUrl;
    language;
    subsequentTooManyRequestsCounter = 0;
    lastTooManyRequestsErrorAt;
    subsequentServerErrorsCounter = 0;
    lastServerErrorAt;
    subsequentOfflineErrorsCounter = 0;
    logger;
    constructor(telemetry, sdkEvents, httpClient, baseUrl, language) {
        this.telemetry = telemetry;
        this.sdkEvents = sdkEvents;
        this.httpClient = httpClient;
        this.baseUrl = baseUrl;
        this.language = language;
        this.logger = telemetry.getLogger('api');
        this.sdkEvents = sdkEvents;
        this.httpClient = httpClient;
        this.baseUrl = baseUrl;
        this.language = language;
        this.telemetry = telemetry;
    }
    async get(url, signal) {
        return this.makeRequest(url, 'GET', undefined, signal);
    }
    async post(url, data, signal) {
        return this.makeRequest(url, 'POST', data, signal);
    }
    async put(url, data, signal) {
        return this.makeRequest(url, 'PUT', data, signal);
    }
    async delete(url, signal) {
        return this.makeRequest(url, 'DELETE', undefined, signal);
    }
    async makeRequest(url, method = 'GET', data, signal) {
        const request = {
            url: `${this.baseUrl}/${url}`,
            method,
            headers: new Headers({
                Accept: 'application/vnd.protonmail.v1+json',
                'Content-Type': 'application/json',
                Language: this.language,
                'x-pm-drive-sdk-version': `js@${version_1.VERSION}`,
            }),
            json: data || undefined,
            timeoutMs: DEFAULT_TIMEOUT_MS,
            signal,
        };
        const response = await this.fetch(request, () => this.httpClient.fetchJson(request));
        try {
            const result = await response.json();
            if (!response.ok || !(0, errorCodes_1.isCodeOk)(result.Code)) {
                throw (0, errors_2.apiErrorFactory)({ response, result });
            }
            if ((0, errorCodes_1.isCodeOkAsync)(result.Code)) {
                this.logger.info(`${request.method} ${request.url}: deferred action`);
            }
            return result;
        }
        catch (error) {
            if (error instanceof errors_1.ProtonDriveError) {
                throw error;
            }
            throw (0, errors_2.apiErrorFactory)({ response, error });
        }
    }
    async getBlockStream(baseUrl, token, signal) {
        const response = await this.makeStorageRequest('GET', baseUrl, token, undefined, undefined, signal);
        if (!response.body) {
            throw new Error((0, ttag_1.c)('Error').t `File download failed due to empty response`);
        }
        return response.body;
    }
    async postBlockStream(baseUrl, token, data, onProgress, signal) {
        await this.makeStorageRequest('POST', baseUrl, token, data, onProgress, signal);
    }
    async makeStorageRequest(method, url, token, body, onProgress, signal) {
        const request = {
            url,
            method,
            headers: new Headers({
                'pm-storage-token': token,
                Language: this.language,
                'x-pm-drive-sdk-version': `js@${version_1.VERSION}`,
            }),
            body,
            onProgress,
            timeoutMs: DEFAULT_STORAGE_TIMEOUT_MS,
            signal,
        };
        const response = await this.fetch(request, () => this.httpClient.fetchBlob(request));
        if (response.status >= 400) {
            try {
                const result = await response.json();
                throw (0, errors_2.apiErrorFactory)({ response, result });
            }
            catch (error) {
                if (error instanceof errors_1.ProtonDriveError) {
                    throw error;
                }
                throw (0, errors_2.apiErrorFactory)({ response, error });
            }
        }
        return response;
    }
    // TODO: add priority header
    // u=2 for interactive (user doing action, e.g., create folder),
    // u=4 for normal (user secondary action, e.g., refresh children listing),
    // u=5 for background (e.g., upload, download)
    // u=7 for optional (e.g., metrics, telemetry)
    async fetch(request, callback, attempt = 0) {
        if (request.signal?.aborted) {
            throw new errors_1.AbortError((0, ttag_1.c)('Error').t `Request aborted`);
        }
        if (attempt > 0) {
            this.logger.debug(`${request.method} ${request.url}: retry ${attempt}`);
        }
        else {
            this.logger.debug(`${request.method} ${request.url}`);
        }
        if (this.hasReachedServerErrorLimit) {
            this.logger.warn('Server errors limit reached');
            throw new errors_1.ServerError((0, ttag_1.c)('Error').t `Too many server errors, please try again later`);
        }
        if (this.hasReachedTooManyRequestsErrorLimit) {
            this.logger.warn('Too many requests limit reached');
            throw new errors_1.RateLimitedError((0, ttag_1.c)('Error').t `Too many server requests, please try again later`);
        }
        const start = Date.now();
        let response;
        try {
            response = await callback();
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    this.logger.debug(`${request.method} ${request.url}: Aborted`);
                    throw new errors_1.AbortError((0, ttag_1.c)('Error').t `Request aborted`);
                }
                if (error.name === 'OfflineError') {
                    this.offlineErrorHappened();
                    this.logger.info(`${request.method} ${request.url}: Offline error, retrying`);
                    await (0, wait_1.waitSeconds)(OFFLINE_RETRY_DELAY_SECONDS);
                    return this.fetch(request, callback, attempt + 1);
                }
                if (error.name === 'TimeoutError' && attempt + 1 < MAX_TIMEOUT_ERROR_RETRY_ATTEMPTS) {
                    this.logger.warn(`${request.method} ${request.url}: Timeout error, retrying`);
                    await (0, wait_1.waitSeconds)(SERVER_ERROR_RETRY_DELAY_SECONDS);
                    return this.fetch(request, callback, attempt + 1);
                }
            }
            if (attempt === 0) {
                this.logger.error(`${request.method} ${request.url}: failed, retrying once`, error);
                await (0, wait_1.waitSeconds)(GENERAL_RETRY_DELAY_SECONDS);
                return this.fetch(request, callback, attempt + 1);
            }
            this.logger.error(`${request.method} ${request.url}: failed`, error);
            throw error;
        }
        this.clearSubsequentOfflineErrors();
        const end = Date.now();
        const duration = end - start;
        if (response.ok) {
            this.logger.info(`${request.method} ${request.url}: ${response.status} (${duration}ms)`);
        }
        else {
            this.logger.warn(`${request.method} ${request.url}: ${response.status} (${duration}ms)`);
        }
        if (response.status === 429 /* HTTPErrorCode.TOO_MANY_REQUESTS */) {
            this.tooManyRequestsErrorHappened();
            const timeout = parseInt(response.headers.get('retry-after') || '0', DEFAULT_429_RETRY_DELAY_SECONDS);
            await (0, wait_1.waitSeconds)(timeout);
            return this.fetch(request, callback, attempt + 1);
        }
        else {
            this.clearSubsequentTooManyRequestsError();
        }
        // Automatically re-try 5xx glitches on the server, but only once
        // and report the incident so it can be followed up.
        if (response.status >= 500) {
            this.serverErrorHappened();
            if (attempt > 0) {
                this.logger.warn(`${request.method} ${request.url}: ${response.status} - retry failed`);
            }
            else {
                await (0, wait_1.waitSeconds)(SERVER_ERROR_RETRY_DELAY_SECONDS);
                return this.fetch(request, callback, attempt + 1);
            }
        }
        else {
            if (attempt > 0) {
                this.telemetry.recordMetric({
                    eventName: 'apiRetrySucceeded',
                    failedAttempts: attempt,
                    url: request.url,
                });
                this.logger.warn(`${request.method} ${request.url}: ${response.status} - retry helped`);
            }
            this.clearSubsequentServerErrors();
        }
        return response;
    }
    get hasReachedTooManyRequestsErrorLimit() {
        const secondsSinceLast429Error = (Date.now() - (this.lastTooManyRequestsErrorAt || Date.now())) / 1000;
        return (this.subsequentTooManyRequestsCounter >= TOO_MANY_SUBSEQUENT_429_ERRORS &&
            secondsSinceLast429Error < TOO_MANY_SUBSEQUENT_429_ERRORS_TIMEOUT_IN_SECONDS);
    }
    tooManyRequestsErrorHappened() {
        this.subsequentTooManyRequestsCounter++;
        this.lastTooManyRequestsErrorAt = Date.now();
        // Do not emit event if there is first few 429 errors, only when
        // the client is very limited. This is generic event and it doesn't
        // take into account that various endpoints can be rate limited
        // independently.
        if (this.subsequentTooManyRequestsCounter === TOO_MANY_SUBSEQUENT_429_ERRORS) {
            this.sdkEvents.requestsThrottled();
        }
    }
    clearSubsequentTooManyRequestsError() {
        if (this.subsequentTooManyRequestsCounter >= TOO_MANY_SUBSEQUENT_429_ERRORS) {
            this.sdkEvents.requestsUnthrottled();
        }
        this.subsequentTooManyRequestsCounter = 0;
        this.lastTooManyRequestsErrorAt = undefined;
    }
    get hasReachedServerErrorLimit() {
        const secondsSinceLastServerError = (Date.now() - (this.lastServerErrorAt || Date.now())) / 1000;
        return (this.subsequentServerErrorsCounter >= TOO_MANY_SUBSEQUENT_SERVER_ERRORS &&
            secondsSinceLastServerError < TOO_MANY_SUBSEQUENT_SERVER_ERRORS_TIMEOUT_IN_SECONDS);
    }
    serverErrorHappened() {
        this.subsequentServerErrorsCounter++;
        this.lastServerErrorAt = Date.now();
    }
    clearSubsequentServerErrors() {
        this.subsequentServerErrorsCounter = 0;
        this.lastServerErrorAt = undefined;
    }
    offlineErrorHappened() {
        this.subsequentOfflineErrorsCounter++;
        if (this.subsequentOfflineErrorsCounter === TOO_MANY_SUBSEQUENT_OFFLINE_ERRORS) {
            this.sdkEvents.transfersPaused();
        }
    }
    clearSubsequentOfflineErrors() {
        if (this.subsequentOfflineErrorsCounter >= TOO_MANY_SUBSEQUENT_OFFLINE_ERRORS) {
            this.sdkEvents.transfersResumed();
        }
        this.subsequentOfflineErrorsCounter = 0;
    }
}
exports.DriveAPIService = DriveAPIService;
//# sourceMappingURL=apiService.js.map