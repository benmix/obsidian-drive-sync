"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeEventManager = void 0;
const telemetry_1 = require("../../telemetry");
const interface_1 = require("./interface");
const apiService_1 = require("../apiService");
/**
 * Combines API and event manager to provide a service for listening to
 * volume events. Volume events are all about nodes updates. Whenever
 * there is update to the node metadata or content, the event is emitted.
 */
class VolumeEventManager {
    logger;
    apiService;
    volumeId;
    constructor(logger, apiService, volumeId) {
        this.logger = logger;
        this.apiService = apiService;
        this.volumeId = volumeId;
        this.apiService = apiService;
        this.volumeId = volumeId;
        this.logger = new telemetry_1.LoggerWithPrefix(logger, `volume ${volumeId}`);
    }
    getLogger() {
        return this.logger;
    }
    async *getEvents(eventId) {
        try {
            let events;
            let more = true;
            while (more) {
                events = await this.apiService.getVolumeEvents(this.volumeId, eventId);
                more = events.more;
                if (events.refresh) {
                    yield {
                        type: interface_1.DriveEventType.TreeRefresh,
                        treeEventScopeId: this.volumeId,
                        eventId: events.latestEventId,
                    };
                    break;
                }
                // Update to the latest eventId to avoid inactive volumes from getting out of sync
                if (events.events.length === 0 && events.latestEventId !== eventId) {
                    yield {
                        type: interface_1.DriveEventType.FastForward,
                        treeEventScopeId: this.volumeId,
                        eventId: events.latestEventId,
                    };
                    break;
                }
                yield* events.events;
                eventId = events.latestEventId;
            }
        }
        catch (error) {
            if (error instanceof apiService_1.NotFoundAPIError) {
                this.logger.info(`Volume events no longer accessible`);
                yield {
                    type: interface_1.DriveEventType.TreeRemove,
                    treeEventScopeId: this.volumeId,
                    // After a TreeRemoval event, polling should stop.
                    eventId: 'none',
                };
            }
            throw error;
        }
    }
    async getLatestEventId() {
        try {
            return await this.apiService.getVolumeLatestEventId(this.volumeId);
        }
        catch (error) {
            if (error instanceof apiService_1.NotFoundAPIError) {
                this.logger.info(`Volume events no longer accessible`);
                throw new interface_1.UnsubscribeFromEventsSourceError(error.message);
            }
            throw error;
        }
    }
}
exports.VolumeEventManager = VolumeEventManager;
//# sourceMappingURL=volumeEventManager.js.map