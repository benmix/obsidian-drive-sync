"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodesCryptoCache = void 0;
/**
 * Provides caching for node crypto material.
 *
 * The cache is responsible for serialising and deserialising node
 * crypto material.
 */
class NodesCryptoCache {
    logger;
    driveCache;
    constructor(logger, driveCache) {
        this.logger = logger;
        this.driveCache = driveCache;
        this.logger = logger;
        this.driveCache = driveCache;
    }
    async setNodeKeys(nodeUid, keys) {
        const cacheUid = getCacheKey(nodeUid);
        await this.driveCache.setEntity(cacheUid, {
            nodeKeys: keys,
        });
    }
    async getNodeKeys(nodeUid) {
        const nodeKeysData = await this.driveCache.getEntity(getCacheKey(nodeUid));
        if (!nodeKeysData.nodeKeys) {
            try {
                await this.removeNodeKeys([nodeUid]);
            }
            catch (removingError) {
                // The node keys will not be returned, thus SDK will re-fetch
                // and re-cache it. Setting it again should then fix the problem.
                this.logger.warn(`Failed to remove corrupted node keys from the cache: ${removingError instanceof Error ? removingError.message : removingError}`);
            }
            throw new Error(`Failed to deserialize node keys`);
        }
        return nodeKeysData.nodeKeys;
    }
    async removeNodeKeys(nodeUids) {
        const cacheUids = nodeUids.map(getCacheKey);
        await this.driveCache.removeEntities(cacheUids);
    }
}
exports.NodesCryptoCache = NodesCryptoCache;
function getCacheKey(nodeUid) {
    return `nodeKeys-${nodeUid}`;
}
//# sourceMappingURL=cryptoCache.js.map