import { ProtonDriveTelemetry } from '../../interface';
import { DriveAPIService } from '../apiService';
import { DriveListener, EventSubscription, LatestEventIdProvider, SharesService } from './interface';
export type { DriveEvent, DriveListener, EventSubscription } from './interface';
export { DriveEventType } from './interface';
/**
 * Service for listening to drive events. The service is responsible for
 * managing the subscriptions to the events and notifying the listeners
 * about the new events.
 */
export declare class DriveEventsService {
    private telemetry;
    private sharesService;
    private cacheEventListeners;
    private latestEventIdProvider?;
    private apiService;
    private coreEventManager?;
    private volumeEventManagers;
    private logger;
    constructor(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, sharesService: SharesService, cacheEventListeners?: DriveListener[], latestEventIdProvider?: LatestEventIdProvider | undefined);
    subscribeToCoreEvents(callback: DriveListener): Promise<EventSubscription>;
    private createCoreEventManager;
    /**
     * Subscribe to drive events. The treeEventScopeId can be obtained from a node.
     */
    subscribeToTreeEvents(treeEventScopeId: string, callback: DriveListener): Promise<EventSubscription>;
    private createVolumeEventManager;
    private getDefaultVolumePollingInterval;
    private sendNumberOfVolumeSubscriptionsToTelemetry;
}
