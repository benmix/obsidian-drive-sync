import { ProtonDriveCryptoCache, Logger } from '../../interface';
import { DecryptedNodeKeys } from './interface';
/**
 * Provides caching for node crypto material.
 *
 * The cache is responsible for serialising and deserialising node
 * crypto material.
 */
export declare class NodesCryptoCache {
    private logger;
    private driveCache;
    constructor(logger: Logger, driveCache: ProtonDriveCryptoCache);
    setNodeKeys(nodeUid: string, keys: DecryptedNodeKeys): Promise<void>;
    getNodeKeys(nodeUid: string): Promise<DecryptedNodeKeys>;
    removeNodeKeys(nodeUids: string[]): Promise<void>;
}
