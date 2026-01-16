import { PrivateKey } from '../../crypto';
import { Logger, MetricVolumeType } from '../../interface';
import { SharesCache } from '../shares/cache';
import { SharesCryptoCache } from '../shares/cryptoCache';
import { SharesCryptoService } from '../shares/cryptoService';
import { EncryptedShare, VolumeShareNodeIDs } from '../shares/interface';
import { PhotosAPIService } from './apiService';
import { SharesService } from './interface';
/**
 * Provides high-level actions for managing photo share.
 *
 * The photo share manager wraps the core share service, but uses photos volume
 * instead of main volume. It provides the same interface so it can be used in
 * the same way in various modules that use shares.
 */
export declare class PhotoSharesManager {
    private logger;
    private apiService;
    private cache;
    private cryptoCache;
    private cryptoService;
    private sharesService;
    private photoRootIds?;
    constructor(logger: Logger, apiService: PhotosAPIService, cache: SharesCache, cryptoCache: SharesCryptoCache, cryptoService: SharesCryptoService, sharesService: SharesService);
    getRootIDs(): Promise<VolumeShareNodeIDs>;
    private createVolume;
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
