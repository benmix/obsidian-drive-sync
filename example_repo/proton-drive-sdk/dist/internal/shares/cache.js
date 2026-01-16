"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharesCache = void 0;
const errors_1 = require("../errors");
/**
 * Provides caching for shares and volume metadata.
 *
 * The cache is responsible for serialising and deserialising volume metadata.
 *
 * This is only intended for the owner's main volume. There is no cache invalidation.
 */
class SharesCache {
    logger;
    driveCache;
    constructor(logger, driveCache) {
        this.logger = logger;
        this.driveCache = driveCache;
        this.logger = logger;
        this.driveCache = driveCache;
    }
    async setVolume(volume) {
        const key = getCacheUid(volume.volumeId);
        const shareData = serializeVolume(volume);
        await this.driveCache.setEntity(key, shareData);
    }
    async getVolume(volumeId) {
        const key = getCacheUid(volumeId);
        const volumeData = await this.driveCache.getEntity(key);
        try {
            return deserializeVolume(volumeData);
        }
        catch (error) {
            try {
                await this.removeVolume(volumeId);
            }
            catch (removingError) {
                this.logger.error('Failed to remove invalid volume from cache', removingError);
            }
            throw new Error(`Failed to deserialize volume: ${(0, errors_1.getErrorMessage)(error)}`);
        }
    }
    async removeVolume(volumeId) {
        await this.driveCache.removeEntities([getCacheUid(volumeId)]);
    }
}
exports.SharesCache = SharesCache;
function getCacheUid(volumeId) {
    return `volume-${volumeId}`;
}
function serializeVolume(volume) {
    return JSON.stringify(volume);
}
function deserializeVolume(shareData) {
    const volume = JSON.parse(shareData);
    if (!volume ||
        typeof volume !== 'object' ||
        !volume.volumeId ||
        typeof volume.volumeId !== 'string' ||
        !volume.shareId ||
        typeof volume.shareId !== 'string' ||
        !volume.rootNodeId ||
        typeof volume.rootNodeId !== 'string' ||
        !volume.creatorEmail ||
        typeof volume.creatorEmail !== 'string' ||
        !volume.addressId ||
        typeof volume.addressId !== 'string') {
        throw new Error('Invalid volume data');
    }
    return volume;
}
//# sourceMappingURL=cache.js.map