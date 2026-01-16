"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticHTTPClient = void 0;
const eventsGenerator_1 = require("./eventsGenerator");
/**
 * Special HTTP client that is compatible with the SDK.
 *
 * It is a probe into SDK to observe whats going on and report any suspicious
 * behavior.
 *
 * It should be used only for diagnostic purposes.
 */
class DiagnosticHTTPClient extends eventsGenerator_1.EventsGenerator {
    httpClient;
    constructor(httpClient) {
        super();
        this.httpClient = httpClient;
        this.httpClient = httpClient;
    }
    async fetchJson(options) {
        try {
            const response = await this.httpClient.fetchJson(options);
            if (response.status >= 400 && response.status !== 429) {
                try {
                    const json = await response.json();
                    this.enqueueEvent({
                        type: 'http_error',
                        request: {
                            url: options.url,
                            method: options.method,
                            json: options.json,
                        },
                        response: {
                            status: response.status,
                            statusText: response.statusText,
                            json,
                        },
                    });
                    return new Response(JSON.stringify(json), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                    });
                }
                catch (jsonError) {
                    this.enqueueEvent({
                        type: 'http_error',
                        request: {
                            url: options.url,
                            method: options.method,
                            json: options.json,
                        },
                        response: {
                            status: response.status,
                            statusText: response.statusText,
                            jsonError,
                        },
                    });
                }
            }
            return response;
        }
        catch (error) {
            this.enqueueEvent({
                type: 'http_error',
                request: {
                    url: options.url,
                    method: options.method,
                    json: options.json,
                },
                error,
            });
            throw error;
        }
    }
    fetchBlob(options) {
        return this.httpClient.fetchBlob(options);
    }
}
exports.DiagnosticHTTPClient = DiagnosticHTTPClient;
//# sourceMappingURL=httpClient.js.map