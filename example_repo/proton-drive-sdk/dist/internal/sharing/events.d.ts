import { Logger } from '../../interface';
import { DriveEvent } from '../events';
import { SharingCache } from './cache';
import { SharesService } from './interface';
export declare class SharingEventHandler {
    private logger;
    private cache;
    private shares;
    constructor(logger: Logger, cache: SharingCache, shares: SharesService);
    /**
     * Update cache and notify listeners accordingly for any updates
     * to nodes that are shared by me.
     *
     * Any node create or update that is being shared, is automatically
     * added to the cache and the listeners are notified about the
     * update of the node.
     *
     * Any node delete or update that is not being shared, and the cache
     * includes the node, is removed from the cache and the listeners are
     * notified about the removal of the node.
     *
     * @throws Only if the client's callback throws.
     */
    handleDriveEvent(event: DriveEvent): Promise<void>;
    private handleSharedByMeNodeUidsLoaded;
}
