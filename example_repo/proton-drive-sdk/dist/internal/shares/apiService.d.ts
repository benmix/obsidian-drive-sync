import { DriveAPIService } from '../apiService';
import { EncryptedShare, EncryptedRootShare, EncryptedShareCrypto } from './interface';
/**
 * Provides API communication for fetching shares and creating volumes.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
export declare class SharesAPIService {
    private apiService;
    constructor(apiService: DriveAPIService);
    getMyFiles(): Promise<EncryptedRootShare>;
    getVolume(volumeId: string): Promise<{
        shareId: string;
    }>;
    getShare(shareId: string): Promise<EncryptedShare>;
    /**
     * Returns root share with address key.
     *
     * This function provides access to root shares that provides access
     * to node tree via address key. For this reason, caller must use this
     * only when it is clear the shareId is root share.
     *
     * @throws Error when share is not root share.
     */
    getRootShare(shareId: string): Promise<EncryptedRootShare>;
    createVolume(share: {
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
    createShare(volumeId: string, share: {
        addressId: string;
    } & EncryptedShareCrypto, node: {
        nodeId: string;
        encryptedName: string;
        nameKeyPacket: string;
        passphraseKeyPacket: string;
    }): Promise<{
        shareId: string;
    }>;
}
