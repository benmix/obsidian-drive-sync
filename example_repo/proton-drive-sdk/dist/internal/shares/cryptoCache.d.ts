import { Logger, ProtonDriveCryptoCache } from '../../interface';
import { DecryptedShareKey } from './interface';
/**
 * Provides caching for share crypto material.
 *
 * The cache is responsible for serialising and deserialising share
 * crypto material.
 *
 * The share crypto materials are cached so the updates to the root
 * nodes can be decrypted without the need to fetch the share keys
 * from the server again. Otherwise the rest of the tree requires
 * only the root node, thus share cache is not needed.
 */
export declare class SharesCryptoCache {
    private logger;
    private driveCache;
    constructor(logger: Logger, driveCache: ProtonDriveCryptoCache);
    setShareKey(shareId: string, key: DecryptedShareKey): Promise<void>;
    getShareKey(shareId: string): Promise<DecryptedShareKey>;
    removeShareKeys(shareIds: string[]): Promise<void>;
}
