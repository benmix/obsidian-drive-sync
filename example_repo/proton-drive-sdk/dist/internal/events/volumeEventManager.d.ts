import { Logger } from '../../interface';
import { EventsAPIService } from './apiService';
import { DriveEvent, EventManagerInterface } from './interface';
/**
 * Combines API and event manager to provide a service for listening to
 * volume events. Volume events are all about nodes updates. Whenever
 * there is update to the node metadata or content, the event is emitted.
 */
export declare class VolumeEventManager implements EventManagerInterface<DriveEvent> {
    private logger;
    private apiService;
    private volumeId;
    constructor(logger: Logger, apiService: EventsAPIService, volumeId: string);
    getLogger(): Logger;
    getEvents(eventId: string): AsyncIterable<DriveEvent>;
    getLatestEventId(): Promise<string>;
}
