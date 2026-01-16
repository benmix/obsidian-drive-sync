"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsubscribeFromEventsSourceError = exports.DriveEventType = void 0;
var DriveEventType;
(function (DriveEventType) {
    DriveEventType["NodeCreated"] = "node_created";
    DriveEventType["NodeUpdated"] = "node_updated";
    DriveEventType["NodeDeleted"] = "node_deleted";
    DriveEventType["SharedWithMeUpdated"] = "shared_with_me_updated";
    DriveEventType["TreeRefresh"] = "tree_refresh";
    DriveEventType["TreeRemove"] = "tree_remove";
    DriveEventType["FastForward"] = "fast_forward";
})(DriveEventType || (exports.DriveEventType = DriveEventType = {}));
/**
 * This can happen if all shared nodes in that volume where unshared or if the
 * volume was deleted.
 */
class UnsubscribeFromEventsSourceError extends Error {
}
exports.UnsubscribeFromEventsSourceError = UnsubscribeFromEventsSourceError;
//# sourceMappingURL=interface.js.map