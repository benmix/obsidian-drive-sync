"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingCache = void 0;
const interface_1 = require("./interface");
/**
 * Provides caching for shared by me and with me listings.
 *
 * The cache is responsible for serialising and deserialising the node
 * UIDs for each sharing type. Also, ensuring that only full lists are
 * cached.
 */
class SharingCache {
    driveCache;
    /**
     * Locally cached data to avoid unnecessary reads from the cache.
     */
    cache = new Map();
    constructor(driveCache) {
        this.driveCache = driveCache;
        this.driveCache = driveCache;
    }
    async getSharedByMeNodeUids() {
        return this.getNodeUids(interface_1.SharingType.SharedByMe);
    }
    async hasSharedByMeNodeUidsLoaded() {
        try {
            await this.getNodeUids(interface_1.SharingType.SharedByMe);
            return true;
        }
        catch {
            return false;
        }
    }
    async addSharedByMeNodeUid(nodeUid) {
        return this.addNodeUid(interface_1.SharingType.SharedByMe, nodeUid);
    }
    async removeSharedByMeNodeUid(nodeUid) {
        return this.removeNodeUid(interface_1.SharingType.SharedByMe, nodeUid);
    }
    async setSharedByMeNodeUids(nodeUids) {
        return this.setNodeUids(interface_1.SharingType.SharedByMe, nodeUids);
    }
    async getSharedWithMeNodeUids() {
        return this.getNodeUids(interface_1.SharingType.SharedWithMe);
    }
    async hasSharedWithMeNodeUidsLoaded() {
        try {
            await this.getNodeUids(interface_1.SharingType.SharedWithMe);
            return true;
        }
        catch {
            return false;
        }
    }
    async addSharedWithMeNodeUid(nodeUid) {
        return this.addNodeUid(interface_1.SharingType.SharedWithMe, nodeUid);
    }
    async removeSharedWithMeNodeUid(nodeUid) {
        return this.removeNodeUid(interface_1.SharingType.SharedWithMe, nodeUid);
    }
    async setSharedWithMeNodeUids(nodeUids) {
        return this.setNodeUids(interface_1.SharingType.SharedWithMe, nodeUids);
    }
    /**
     * @throws Error if the cache is not set yet. First, the cache should be
     *        set by calling `setNodeUids` after full loading of the list.
     */
    async addNodeUid(type, nodeUid) {
        let nodeUids;
        try {
            nodeUids = await this.getNodeUids(type);
        }
        catch {
            // This is developer error.
            throw new Error('Calling add before setting the loaded items');
        }
        const set = new Set(nodeUids);
        if (set.has(nodeUid)) {
            return;
        }
        set.add(nodeUid);
        await this.setNodeUids(type, [...set]);
    }
    /**
     * @throws Error if the cache is not set yet. First, the cache should be
     *        set by calling `setNodeUids` after full loading of the list.
     */
    async removeNodeUid(type, nodeUid) {
        let nodeUids;
        try {
            nodeUids = await this.getNodeUids(type);
        }
        catch {
            // This is developer error.
            throw new Error('Calling remove before setting the loaded items');
        }
        const set = new Set(nodeUids);
        if (!set.has(nodeUid)) {
            return;
        }
        set.delete(nodeUid);
        await this.setNodeUids(type, [...set]);
    }
    async getNodeUids(type) {
        let nodeUids = this.cache.get(type);
        if (nodeUids) {
            return nodeUids;
        }
        const nodeUidsString = await this.driveCache.getEntity(`sharing-${type}-nodeUids`);
        nodeUids = nodeUidsString.split(',');
        this.cache.set(type, nodeUids);
        return nodeUids;
    }
    /**
     * @param nodeUids - Passing `undefined` will remove the cache.
     */
    async setNodeUids(type, nodeUids) {
        if (nodeUids) {
            this.cache.set(type, nodeUids);
            await this.driveCache.setEntity(`sharing-${type}-nodeUids`, nodeUids.join(','));
        }
        else {
            this.cache.delete(type);
            await this.driveCache.removeEntities([`sharing-${type}-nodeUids`]);
        }
    }
}
exports.SharingCache = SharingCache;
//# sourceMappingURL=cache.js.map