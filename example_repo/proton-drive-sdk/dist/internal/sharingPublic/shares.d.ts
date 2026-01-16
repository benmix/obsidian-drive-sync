import { PrivateKey } from '../../crypto';
import { MetricVolumeType, ProtonDriveAccount } from '../../interface';
/**
 * Provides high-level actions for managing public link share.
 *
 * The public link share manager provides the same interface as the code share
 * service so it can be used in the same way in various modules that use shares.
 */
export declare class SharingPublicSharesManager {
    private account;
    private publicShareKey;
    private publicRootNodeUid;
    constructor(account: ProtonDriveAccount, publicShareKey: PrivateKey, publicRootNodeUid: string);
    getRootIDs(): Promise<{
        volumeId: string;
        rootNodeId: string;
        rootNodeUid: string;
    }>;
    getSharePrivateKey(): Promise<PrivateKey>;
    getContextShareMemberEmailKey(): Promise<{
        email: string;
        addressId: string;
        addressKey: PrivateKey;
        addressKeyId: string;
    }>;
    getVolumeMetricContext(): Promise<MetricVolumeType>;
}
