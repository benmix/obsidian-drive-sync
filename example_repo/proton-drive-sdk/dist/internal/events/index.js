"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveEventsService = exports.DriveEventType = void 0;
const apiService_1 = require("./apiService");
const coreEventManager_1 = require("./coreEventManager");
const volumeEventManager_1 = require("./volumeEventManager");
const eventManager_1 = require("./eventManager");
var interface_1 = require("./interface");
Object.defineProperty(exports, "DriveEventType", { enumerable: true, get: function () { return interface_1.DriveEventType; } });
const OWN_VOLUME_POLLING_INTERVAL = 30;
const OTHER_VOLUME_POLLING_INTERVAL = 60;
const CORE_POLLING_INTERVAL = 30;
/**
 * Service for listening to drive events. The service is responsible for
 * managing the subscriptions to the events and notifying the listeners
 * about the new events.
 */
class DriveEventsService {
    telemetry;
    sharesService;
    cacheEventListeners;
    latestEventIdProvider;
    apiService;
    coreEventManager;
    volumeEventManagers;
    logger;
    constructor(telemetry, apiService, sharesService, cacheEventListeners = [], latestEventIdProvider) {
        this.telemetry = telemetry;
        this.sharesService = sharesService;
        this.cacheEventListeners = cacheEventListeners;
        this.latestEventIdProvider = latestEventIdProvider;
        this.telemetry = telemetry;
        this.logger = telemetry.getLogger('events');
        this.apiService = new apiService_1.EventsAPIService(apiService);
        this.volumeEventManagers = {};
    }
    // FIXME: Allow to pass own core events manager from the public interface.
    async subscribeToCoreEvents(callback) {
        let manager = this.coreEventManager;
        const started = !!manager;
        if (manager === undefined) {
            manager = await this.createCoreEventManager();
            this.coreEventManager = manager;
        }
        const eventSubscription = manager.addListener(callback);
        if (!started) {
            await manager.start();
        }
        return eventSubscription;
    }
    async createCoreEventManager() {
        if (!this.latestEventIdProvider) {
            throw new Error('Cannot subscribe to events without passing a latestEventIdProvider in ProtonDriveClient initialization');
        }
        const coreEventManager = new coreEventManager_1.CoreEventManager(this.logger, this.apiService);
        const latestEventId = this.latestEventIdProvider.getLatestEventId('core') ?? null;
        const eventManager = new eventManager_1.EventManager(coreEventManager, CORE_POLLING_INTERVAL, latestEventId);
        for (const listener of this.cacheEventListeners) {
            eventManager.addListener(listener);
        }
        return eventManager;
    }
    /**
     * Subscribe to drive events. The treeEventScopeId can be obtained from a node.
     */
    async subscribeToTreeEvents(treeEventScopeId, callback) {
        const volumeId = treeEventScopeId;
        let manager = this.volumeEventManagers[volumeId];
        const started = !!manager;
        if (manager === undefined) {
            manager = await this.createVolumeEventManager(volumeId);
            this.volumeEventManagers[volumeId] = manager;
        }
        const eventSubscription = manager.addListener(callback);
        if (!started) {
            await manager.start();
            this.sendNumberOfVolumeSubscriptionsToTelemetry();
        }
        return eventSubscription;
    }
    async createVolumeEventManager(volumeId) {
        if (!this.latestEventIdProvider) {
            throw new Error('Cannot subscribe to events without passing a latestEventIdProvider in ProtonDriveClient initialization');
        }
        this.logger.debug(`Creating volume event manager for volume ${volumeId}`);
        const volumeEventManager = new volumeEventManager_1.VolumeEventManager(this.logger, this.apiService, volumeId);
        const isOwnVolume = await this.sharesService.isOwnVolume(volumeId);
        const pollingInterval = this.getDefaultVolumePollingInterval(isOwnVolume);
        const latestEventId = this.latestEventIdProvider.getLatestEventId(volumeId);
        const eventManager = new eventManager_1.EventManager(volumeEventManager, pollingInterval, latestEventId);
        for (const listener of this.cacheEventListeners) {
            eventManager.addListener(listener);
        }
        return eventManager;
    }
    getDefaultVolumePollingInterval(isOwnVolume) {
        return isOwnVolume ? OWN_VOLUME_POLLING_INTERVAL : OTHER_VOLUME_POLLING_INTERVAL;
    }
    sendNumberOfVolumeSubscriptionsToTelemetry() {
        this.telemetry.recordMetric({
            eventName: 'volumeEventsSubscriptionsChanged',
            numberOfVolumeSubscriptions: Object.keys(this.volumeEventManagers).length,
        });
    }
}
exports.DriveEventsService = DriveEventsService;
//# sourceMappingURL=index.js.map