"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingPublicAPIService = void 0;
/**
 * Provides API communication for actions on the public link.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
class SharingPublicAPIService {
    apiService;
    constructor(apiService) {
        this.apiService = apiService;
        this.apiService = apiService;
    }
    async bookmarkPublicLink(bookmark) {
        await this.apiService.post(`drive/v2/urls/${bookmark.token}/bookmark`, {
            BookmarkShareURL: {
                EncryptedUrlPassword: bookmark.encryptedUrlPassword,
                AddressID: bookmark.addressId,
                AddressKeyID: bookmark.addressKeyId,
            },
        });
    }
}
exports.SharingPublicAPIService = SharingPublicAPIService;
//# sourceMappingURL=apiService.js.map