"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDiagnostic = initDiagnostic;
const cache_1 = require("../cache");
const protonDriveClient_1 = require("../protonDriveClient");
const diagnostic_1 = require("./diagnostic");
const httpClient_1 = require("./httpClient");
const telemetry_1 = require("./telemetry");
const protonDrivePhotosClient_1 = require("../protonDrivePhotosClient");
/**
 * Initializes the diagnostic tool. It creates the instance of
 * ProtonDriveClient with the special probes to observe the logs,
 * metrics and HTTP calls; and enforced null/empty cache to always
 * start from scratch.
 */
function initDiagnostic(options) {
    const httpClient = new httpClient_1.DiagnosticHTTPClient(options.httpClient);
    const telemetry = new telemetry_1.DiagnosticTelemetry();
    const protonDriveClient = new protonDriveClient_1.ProtonDriveClient({
        ...options,
        httpClient,
        // Ensure we always start with a clean state.
        // Do not use memory cache as diagnostic should visit each node
        // only once and we don't want to grow memory usage.
        entitiesCache: new cache_1.NullCache(),
        // However, we need to use memory cache for crypto cache to avoid
        // re-fetching the same key for all the children.
        cryptoCache: new cache_1.MemoryCache(),
        // Special telemetry that observes the logs and metrics.
        telemetry,
    });
    const protonDrivePhotosClient = new protonDrivePhotosClient_1.ProtonDrivePhotosClient({
        ...options,
        httpClient,
        entitiesCache: new cache_1.NullCache(),
        cryptoCache: new cache_1.MemoryCache(),
        telemetry,
    });
    return new diagnostic_1.Diagnostic(telemetry, httpClient, protonDriveClient, protonDrivePhotosClient);
}
//# sourceMappingURL=index.js.map