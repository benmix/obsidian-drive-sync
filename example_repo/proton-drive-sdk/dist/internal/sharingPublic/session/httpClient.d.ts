import { ProtonDriveHTTPClient, ProtonDriveHTTPClientBlobRequest, ProtonDriveHTTPClientJsonRequest } from '../../../interface';
import { SharingPublicLinkSession } from './session';
/**
 * HTTP client to get access to public link of given session.
 *
 * It is responsible for adding the session headers to the request if the session
 * is authenticated, and re-authenticating the session if the session is expired.
 */
export declare class SharingPublicSessionHttpClient implements ProtonDriveHTTPClient {
    private httpClient;
    private session;
    constructor(httpClient: ProtonDriveHTTPClient, session: SharingPublicLinkSession);
    fetchJson(options: ProtonDriveHTTPClientJsonRequest): Promise<Response>;
    fetchBlob(options: ProtonDriveHTTPClientBlobRequest): Promise<Response>;
    private getOptionsWithSessionHeaders;
}
