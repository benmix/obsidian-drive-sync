import { DriveAPIService } from '../apiService';
import { EncryptedRootShare, EncryptedShareCrypto } from '../shares/interface';
/**
 * Provides API communication for fetching and manipulating photos and albums
 * metadata.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
export declare class PhotosAPIService {
    private apiService;
    constructor(apiService: DriveAPIService);
    getPhotoShare(): Promise<EncryptedRootShare>;
    createPhotoVolume(share: {
        addressId: string;
        addressKeyId: string;
    } & EncryptedShareCrypto, node: {
        encryptedName: string;
        armoredKey: string;
        armoredPassphrase: string;
        armoredPassphraseSignature: string;
        armoredHashKey: string;
    }): Promise<{
        volumeId: string;
        shareId: string;
        rootNodeId: string;
    }>;
    iterateTimeline(volumeId: string, signal?: AbortSignal): AsyncGenerator<{
        nodeUid: string;
        captureTime: Date;
        tags: number[];
    }>;
    iterateAlbums(volumeId: string, signal?: AbortSignal): AsyncGenerator<{
        albumUid: string;
        coverNodeUid?: string;
        photoCount: number;
        lastActivityTime: Date;
    }>;
    checkPhotoDuplicates(volumeId: string, nameHashes: string[], signal?: AbortSignal): Promise<{
        nameHash: string;
        contentHash: string;
        nodeUid: string;
        clientUid?: string;
    }[]>;
}
