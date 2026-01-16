import { DriveAPIService } from '../apiService';
/**
 * Drive API Service for public links.
 *
 * This service is used to make requests to the Drive API without
 * authentication. The unauth context uses the same endpoint, but
 * with an `unauth` prefix. The goal is to avoid the need to use
 * different path and use the exact endpoint for both contexts.
 * However, API has global logic for handling expired sessions that
 * is not compatible with the unauth context. For this reason, this
 * service is used to make requests to the Drive API for public
 * link context in the mean time.
 */
export declare class UnauthDriveAPIService extends DriveAPIService {
    protected makeRequest<RequestPayload, ResponsePayload>(url: string, method?: string, data?: RequestPayload, signal?: AbortSignal): Promise<ResponsePayload>;
}
export declare function getUnauthEndpoint(url: string): string;
