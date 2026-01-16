"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsAPIService = void 0;
const uids_1 = require("../uids");
const interface_1 = require("./interface");
const VOLUME_EVENT_TYPE_MAP = {
    0: interface_1.DriveEventType.NodeDeleted,
    1: interface_1.DriveEventType.NodeCreated,
    2: interface_1.DriveEventType.NodeUpdated,
    3: interface_1.DriveEventType.NodeUpdated,
};
/**
 * Provides API communication for fetching events.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
class EventsAPIService {
    apiService;
    constructor(apiService) {
        this.apiService = apiService;
        this.apiService = apiService;
    }
    async getCoreLatestEventId() {
        const result = await this.apiService.get(`core/v4/events/latest`);
        return result.EventID;
    }
    async getCoreEvents(eventId) {
        // TODO: Switch to v6 endpoint?
        const result = await this.apiService.get(`core/v5/events/${eventId}`);
        // in core/v5/events, refresh is always all apps, value 255
        const refresh = result.Refresh > 0;
        const events = refresh || result.DriveShareRefresh?.Action === 2
            ? [
                {
                    type: interface_1.DriveEventType.SharedWithMeUpdated,
                    eventId: result.EventID,
                    treeEventScopeId: 'core',
                },
            ]
            : [];
        return {
            latestEventId: result.EventID,
            more: result.More === 1,
            refresh,
            events,
        };
    }
    async getVolumeLatestEventId(volumeId) {
        const result = await this.apiService.get(`drive/volumes/${volumeId}/events/latest`);
        return result.EventID;
    }
    async getVolumeEvents(volumeId, eventId) {
        const result = await this.apiService.get(`drive/v2/volumes/${volumeId}/events/${eventId}`);
        return {
            latestEventId: result.EventID,
            more: result.More,
            refresh: result.Refresh,
            events: result.Events.map((event) => {
                const type = VOLUME_EVENT_TYPE_MAP[event.EventType];
                const uids = {
                    nodeUid: (0, uids_1.makeNodeUid)(volumeId, event.Link.LinkID),
                    parentNodeUid: (0, uids_1.makeNodeUid)(volumeId, event.Link.ParentLinkID),
                };
                return {
                    type,
                    ...uids,
                    isTrashed: event.Link.IsTrashed,
                    isShared: event.Link.IsShared,
                    eventId: event.EventID,
                    treeEventScopeId: volumeId,
                };
            }),
        };
    }
}
exports.EventsAPIService = EventsAPIService;
//# sourceMappingURL=apiService.js.map