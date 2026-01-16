"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreEventManager = void 0;
const telemetry_1 = require("../../telemetry");
const interface_1 = require("./interface");
/**
 * Combines API and event manager to provide a service for listening to
 * core events. Core events are events that are not specific to any volume.
 * At this moment, Drive listenes only to shares with me updates from core
 * events. Such even indicates that user was invited to the new share or
 * that user's membership was removed from existing one and lost access.
 *
 * The client might be already using own core events, thus this service
 * is here only in case the client is not connected to the Proton services
 * with own implementation.
 */
class CoreEventManager {
    logger;
    apiService;
    constructor(logger, apiService) {
        this.logger = logger;
        this.apiService = apiService;
        this.apiService = apiService;
        this.logger = new telemetry_1.LoggerWithPrefix(logger, `core`);
    }
    async getLatestEventId() {
        return await this.apiService.getCoreLatestEventId();
    }
    async *getEvents(eventId) {
        const events = await this.apiService.getCoreEvents(eventId);
        if (events.events.length === 0 && events.latestEventId !== eventId) {
            yield {
                type: interface_1.DriveEventType.FastForward,
                treeEventScopeId: 'core',
                eventId: events.latestEventId,
            };
            return;
        }
        yield* events.events;
    }
    getLogger() {
        return this.logger;
    }
}
exports.CoreEventManager = CoreEventManager;
//# sourceMappingURL=coreEventManager.js.map