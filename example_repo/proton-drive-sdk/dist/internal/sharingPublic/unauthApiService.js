"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnauthDriveAPIService = void 0;
exports.getUnauthEndpoint = getUnauthEndpoint;
const apiService_1 = require("../apiService");
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
class UnauthDriveAPIService extends apiService_1.DriveAPIService {
    async makeRequest(url, method = 'GET', data, signal) {
        const unauthUrl = getUnauthEndpoint(url);
        return super.makeRequest(unauthUrl, method, data, signal);
    }
}
exports.UnauthDriveAPIService = UnauthDriveAPIService;
function getUnauthEndpoint(url) {
    if (url.startsWith('drive/urls/') || url.startsWith('drive/v2/urls/')) {
        return url;
    }
    return url.replace(/^drive\//, 'drive/unauth/');
}
//# sourceMappingURL=unauthApiService.js.map