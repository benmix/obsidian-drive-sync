"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingPublicSessionHttpClient = void 0;
/**
 * HTTP client to get access to public link of given session.
 *
 * It is responsible for adding the session headers to the request if the session
 * is authenticated, and re-authenticating the session if the session is expired.
 */
class SharingPublicSessionHttpClient {
    httpClient;
    session;
    constructor(httpClient, session) {
        this.httpClient = httpClient;
        this.session = session;
        this.httpClient = httpClient;
        this.session = session;
    }
    async fetchJson(options) {
        const response = await this.httpClient.fetchJson(this.getOptionsWithSessionHeaders(options));
        if (response.status === 401 /* HTTPErrorCode.UNAUTHORIZED */) {
            await this.session.reauth();
            return this.httpClient.fetchJson(this.getOptionsWithSessionHeaders(options));
        }
        return response;
    }
    async fetchBlob(options) {
        return this.httpClient.fetchBlob(this.getOptionsWithSessionHeaders(options));
    }
    getOptionsWithSessionHeaders(options) {
        // Set headers if the session is newly created.
        // This is needed only if the user is not logged in.
        if (this.session.session.accessToken) {
            options.headers.set('x-pm-uid', this.session.session.uid);
            options.headers.set('Authorization', `Bearer ${this.session.session.accessToken}`);
        }
        return options;
    }
}
exports.SharingPublicSessionHttpClient = SharingPublicSessionHttpClient;
//# sourceMappingURL=httpClient.js.map