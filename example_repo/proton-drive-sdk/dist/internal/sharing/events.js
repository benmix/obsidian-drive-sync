"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingEventHandler = void 0;
const events_1 = require("../events");
class SharingEventHandler {
    logger;
    cache;
    shares;
    constructor(logger, cache, shares) {
        this.logger = logger;
        this.cache = cache;
        this.shares = shares;
    }
    /**
     * Update cache and notify listeners accordingly for any updates
     * to nodes that are shared by me.
     *
     * Any node create or update that is being shared, is automatically
     * added to the cache and the listeners are notified about the
     * update of the node.
     *
     * Any node delete or update that is not being shared, and the cache
     * includes the node, is removed from the cache and the listeners are
     * notified about the removal of the node.
     *
     * @throws Only if the client's callback throws.
     */
    async handleDriveEvent(event) {
        try {
            if (event.type === events_1.DriveEventType.SharedWithMeUpdated) {
                await this.cache.setSharedWithMeNodeUids(undefined);
                return;
            }
            await this.handleSharedByMeNodeUidsLoaded(event);
        }
        catch (error) {
            this.logger.error(`Skipping shared by me node cache update`, error);
        }
    }
    async handleSharedByMeNodeUidsLoaded(event) {
        if (event.type === events_1.DriveEventType.TreeRefresh || event.type === events_1.DriveEventType.TreeRemove) {
            await this.cache.setSharedWithMeNodeUids(undefined);
            return;
        }
        if (![events_1.DriveEventType.NodeCreated, events_1.DriveEventType.NodeUpdated, events_1.DriveEventType.NodeDeleted].includes(event.type)) {
            return;
        }
        const hasSharedByMeLoaded = await this.cache.hasSharedByMeNodeUidsLoaded();
        if (!hasSharedByMeLoaded) {
            return;
        }
        const isOwnVolume = await this.shares.isOwnVolume(event.treeEventScopeId);
        if (!isOwnVolume) {
            return;
        }
        if (event.type === events_1.DriveEventType.NodeCreated || event.type == events_1.DriveEventType.NodeUpdated) {
            if (event.isShared && !event.isTrashed) {
                await this.cache.addSharedByMeNodeUid(event.nodeUid);
            }
            else {
                await this.cache.removeSharedByMeNodeUid(event.nodeUid);
            }
        }
        if (event.type === events_1.DriveEventType.NodeDeleted) {
            await this.cache.removeSharedByMeNodeUid(event.nodeUid);
        }
    }
}
exports.SharingEventHandler = SharingEventHandler;
//# sourceMappingURL=events.js.map