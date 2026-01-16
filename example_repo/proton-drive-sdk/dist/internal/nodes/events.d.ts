import { Logger } from '../../interface';
import { DriveEvent } from '../events';
import { NodesCacheBase } from './cache';
/**
 * Provides internal event handling.
 *
 * The service is responsible for handling events regarding node metadata
 * from the DriveEventsService.
 */
export declare class NodesEventsHandler {
    private logger;
    private cache;
    constructor(logger: Logger, cache: NodesCacheBase);
    updateNodesCacheOnEvent(event: DriveEvent): Promise<void>;
}
