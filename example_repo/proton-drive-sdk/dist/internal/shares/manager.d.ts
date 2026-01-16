import { Logger, MetricVolumeType, ProtonDriveAccount } from '../../interface';
import { PrivateKey } from '../../crypto';
import { SharesAPIService } from './apiService';
import { SharesCache } from './cache';
import { SharesCryptoCache } from './cryptoCache';
import { SharesCryptoService } from './cryptoService';
import { VolumeShareNodeIDs, EncryptedShare } from './interface';
/**
 * Provides high-level actions for managing shares.
 *
 * The manager is responsible for handling shares metadata, including
 * API communication, encryption, decryption, and caching.
 *
 * This module uses other modules providing low-level operations, such
 * as API service, cache, crypto service, etc.
 */
export declare class SharesManager {
    private logger;
    private apiService;
    private cache;
    private cryptoCache;
    private cryptoService;
    private account;
    private myFilesIds?;
    private rootShares;
    constructor(logger: Logger, apiService: SharesAPIService, cache: SharesCache, cryptoCache: SharesCryptoCache, cryptoService: SharesCryptoService, account: ProtonDriveAccount);
    /**
     * It returns the IDs of the My files section.
     *
     * If the default volume or My files section doesn't exist, it creates it.
     */
    getRootIDs(): Promise<VolumeShareNodeIDs>;
    /**
     * Creates new default volume for the user.
     *
     * It generates the volume bootstrap, creates the volume on the server,
     * and caches the volume metadata.
     *
     * User can have only one default volume.
     *
     * @throws If the volume cannot be created (e.g., one already exists).
     */
    private createVolume;
    /**
     * It is a high-level action that retrieves the private key for a share.
     * If prefers to use the cache, but if the key is not there, it fetches
     * the share from the API, decrypts it, and caches it.
     *
     * @param shareId - The ID of the share.
     * @returns The private key for the share.
     * @throws If the share is not found or cannot be decrypted, or cached.
     */
    getSharePrivateKey(shareId: string): Promise<PrivateKey>;
    getMyFilesShareMemberEmailKey(): Promise<{
        email: string;
        addressId: string;
        addressKey: PrivateKey;
        addressKeyId: string;
    }>;
    getContextShareMemberEmailKey(shareId: string): Promise<{
        email: string;
        addressId: string;
        addressKey: PrivateKey;
        addressKeyId: string;
    }>;
    isOwnVolume(volumeId: string): Promise<boolean>;
    getVolumeMetricContext(volumeId: string): Promise<MetricVolumeType>;
    loadEncryptedShare(shareId: string): Promise<EncryptedShare>;
}
