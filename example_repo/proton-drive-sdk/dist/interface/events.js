"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveEventType = exports.SDKEvent = void 0;
var SDKEvent;
(function (SDKEvent) {
    SDKEvent["TransfersPaused"] = "transfersPaused";
    SDKEvent["TransfersResumed"] = "transfersResumed";
    SDKEvent["RequestsThrottled"] = "requestsThrottled";
    SDKEvent["RequestsUnthrottled"] = "requestsUnthrottled";
})(SDKEvent || (exports.SDKEvent = SDKEvent = {}));
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
//# sourceMappingURL=events.js.map