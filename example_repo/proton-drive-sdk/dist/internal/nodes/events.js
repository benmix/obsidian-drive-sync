"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodesEventsHandler = void 0;
const events_1 = require("../events");
/**
 * Provides internal event handling.
 *
 * The service is responsible for handling events regarding node metadata
 * from the DriveEventsService.
 */
class NodesEventsHandler {
    logger;
    cache;
    constructor(logger, cache) {
        this.logger = logger;
        this.cache = cache;
    }
    async updateNodesCacheOnEvent(event) {
        try {
            if (event.type === events_1.DriveEventType.TreeRefresh) {
                await this.cache.setNodesStaleFromVolume(event.treeEventScopeId);
                return;
            }
            if (event.type === events_1.DriveEventType.TreeRemove) {
                await this.cache.removeVolume(event.treeEventScopeId);
                return;
            }
            if (event.type === events_1.DriveEventType.NodeDeleted) {
                await this.cache.removeNodes([event.nodeUid]);
                return;
            }
            if (event.type === events_1.DriveEventType.NodeCreated) {
                // FIXME Add it to the parent listing even if it's not cached
                // so it doesn't need to refetch all children
                // We do not have partial nodes in the cache, so we don't
                // add it. If new node is not added, we need to reset the
                // children loaded flag to force refetch when requested.
                if (event.parentNodeUid) {
                    await this.cache.resetFolderChildrenLoaded(event.parentNodeUid);
                }
                return;
            }
            if (event.type === events_1.DriveEventType.NodeUpdated) {
                let node;
                try {
                    node = await this.cache.getNode(event.nodeUid);
                }
                catch {
                    return;
                }
                node.isStale = true;
                node.parentUid = event.parentNodeUid;
                node.isShared = event.isShared;
                if (event.isTrashed) {
                    node.trashTime ??= new Date();
                }
                else {
                    node.trashTime = undefined;
                }
                await this.cache.setNode(node);
            }
        }
        catch (error) {
            this.logger.error(`Failed to update node cache for event: ${event.eventId}`, error);
        }
    }
}
exports.NodesEventsHandler = NodesEventsHandler;
//# sourceMappingURL=events.js.map