import { ProtonDriveHTTPClient, ProtonDriveTelemetry } from '../../interface';
import { SDKEvents } from '../sdkEvents';
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
export declare class DriveAPIService {
    private telemetry;
    private sdkEvents;
    private httpClient;
    private baseUrl;
    private language;
    private subsequentTooManyRequestsCounter;
    private lastTooManyRequestsErrorAt?;
    private subsequentServerErrorsCounter;
    private lastServerErrorAt?;
    private subsequentOfflineErrorsCounter;
    private logger;
    constructor(telemetry: ProtonDriveTelemetry, sdkEvents: SDKEvents, httpClient: ProtonDriveHTTPClient, baseUrl: string, language: string);
    get<ResponsePayload>(url: string, signal?: AbortSignal): Promise<ResponsePayload>;
    post<RequestPayload, ResponsePayload>(url: string, data?: RequestPayload, signal?: AbortSignal): Promise<ResponsePayload>;
    put<RequestPayload, ResponsePayload>(url: string, data: RequestPayload, signal?: AbortSignal): Promise<ResponsePayload>;
    delete<Response>(url: string, signal?: AbortSignal): Promise<Response>;
    protected makeRequest<RequestPayload, ResponsePayload>(url: string, method?: string, data?: RequestPayload, signal?: AbortSignal): Promise<ResponsePayload>;
    getBlockStream(baseUrl: string, token: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>;
    postBlockStream(baseUrl: string, token: string, data: XMLHttpRequestBodyInit, onProgress?: (uploadedBytes: number) => void, signal?: AbortSignal): Promise<void>;
    protected makeStorageRequest(method: 'GET' | 'POST', url: string, token: string, body?: XMLHttpRequestBodyInit, onProgress?: (uploadedBytes: number) => void, signal?: AbortSignal): Promise<Response>;
    private fetch;
    private get hasReachedTooManyRequestsErrorLimit();
    private tooManyRequestsErrorHappened;
    private clearSubsequentTooManyRequestsError;
    private get hasReachedServerErrorLimit();
    private serverErrorHappened;
    private clearSubsequentServerErrors;
    private offlineErrorHappened;
    private clearSubsequentOfflineErrors;
}
