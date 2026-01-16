import { ProtonDriveHTTPClient, ProtonDriveHTTPClientBlobRequest, ProtonDriveHTTPClientJsonRequest } from '../interface';
import { EventsGenerator } from './eventsGenerator';
/**
 * Special HTTP client that is compatible with the SDK.
 *
 * It is a probe into SDK to observe whats going on and report any suspicious
 * behavior.
 *
 * It should be used only for diagnostic purposes.
 */
export declare class DiagnosticHTTPClient extends EventsGenerator implements ProtonDriveHTTPClient {
    private httpClient;
    constructor(httpClient: ProtonDriveHTTPClient);
    fetchJson(options: ProtonDriveHTTPClientJsonRequest): Promise<Response>;
    fetchBlob(options: ProtonDriveHTTPClientBlobRequest): Promise<Response>;
}
