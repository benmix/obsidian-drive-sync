import { ProtonDriveEntitiesCache, Logger } from '../../interface';
import { Volume } from './interface';
/**
 * Provides caching for shares and volume metadata.
 *
 * The cache is responsible for serialising and deserialising volume metadata.
 *
 * This is only intended for the owner's main volume. There is no cache invalidation.
 */
export declare class SharesCache {
    private logger;
    private driveCache;
    constructor(logger: Logger, driveCache: ProtonDriveEntitiesCache);
    setVolume(volume: Volume): Promise<void>;
    getVolume(volumeId: string): Promise<Volume>;
    removeVolume(volumeId: string): Promise<void>;
}
