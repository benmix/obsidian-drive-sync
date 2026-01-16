"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharesCryptoCache = void 0;
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
class SharesCryptoCache {
    logger;
    driveCache;
    constructor(logger, driveCache) {
        this.logger = logger;
        this.driveCache = driveCache;
        this.logger = logger;
        this.driveCache = driveCache;
    }
    async setShareKey(shareId, key) {
        await this.driveCache.setEntity(getCacheKey(shareId), {
            shareKey: key,
        });
    }
    async getShareKey(shareId) {
        const nodeKeysData = await this.driveCache.getEntity(getCacheKey(shareId));
        if (!nodeKeysData.shareKey) {
            try {
                await this.removeShareKeys([shareId]);
            }
            catch (removingError) {
                // The node keys will not be returned, thus SDK will re-fetch
                // and re-cache it. Setting it again should then fix the problem.
                this.logger.warn(`Failed to remove corrupted node keys from the cache: ${removingError instanceof Error ? removingError.message : removingError}`);
            }
            throw new Error(`Failed to deserialize node keys`);
        }
        return nodeKeysData.shareKey;
    }
    async removeShareKeys(shareIds) {
        await this.driveCache.removeEntities(shareIds.map(getCacheKey));
    }
}
exports.SharesCryptoCache = SharesCryptoCache;
function getCacheKey(shareId) {
    return `shareKey-${shareId}`;
}
//# sourceMappingURL=cryptoCache.js.map