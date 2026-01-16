import { Logger } from '../../interface';
import { EventsAPIService } from './apiService';
import { DriveEvent, EventManagerInterface } from './interface';
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
export declare class CoreEventManager implements EventManagerInterface<DriveEvent> {
    private logger;
    private apiService;
    constructor(logger: Logger, apiService: EventsAPIService);
    getLatestEventId(): Promise<string>;
    getEvents(eventId: string): AsyncIterable<DriveEvent>;
    getLogger(): Logger;
}
