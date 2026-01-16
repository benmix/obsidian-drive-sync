import { DriveAPIService } from '../apiService';
/**
 * Provides API communication for actions on the public link.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
export declare class SharingPublicAPIService {
    private apiService;
    constructor(apiService: DriveAPIService);
    bookmarkPublicLink(bookmark: {
        token: string;
        encryptedUrlPassword: string;
        addressId: string;
        addressKeyId: string;
    }): Promise<void>;
}
