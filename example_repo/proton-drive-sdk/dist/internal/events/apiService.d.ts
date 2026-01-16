import { DriveAPIService } from '../apiService';
import { DriveEventsListWithStatus } from './interface';
/**
 * Provides API communication for fetching events.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
export declare class EventsAPIService {
    private apiService;
    constructor(apiService: DriveAPIService);
    getCoreLatestEventId(): Promise<string>;
    getCoreEvents(eventId: string): Promise<DriveEventsListWithStatus>;
    getVolumeLatestEventId(volumeId: string): Promise<string>;
    getVolumeEvents(volumeId: string, eventId: string): Promise<DriveEventsListWithStatus>;
}
