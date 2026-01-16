import { ProtonDriveEntitiesCache } from '../../interface';
/**
 * Provides caching for shared by me and with me listings.
 *
 * The cache is responsible for serialising and deserialising the node
 * UIDs for each sharing type. Also, ensuring that only full lists are
 * cached.
 */
export declare class SharingCache {
    private driveCache;
    /**
     * Locally cached data to avoid unnecessary reads from the cache.
     */
    private cache;
    constructor(driveCache: ProtonDriveEntitiesCache);
    getSharedByMeNodeUids(): Promise<string[]>;
    hasSharedByMeNodeUidsLoaded(): Promise<boolean>;
    addSharedByMeNodeUid(nodeUid: string): Promise<void>;
    removeSharedByMeNodeUid(nodeUid: string): Promise<void>;
    setSharedByMeNodeUids(nodeUids: string[] | undefined): Promise<void>;
    getSharedWithMeNodeUids(): Promise<string[]>;
    hasSharedWithMeNodeUidsLoaded(): Promise<boolean>;
    addSharedWithMeNodeUid(nodeUid: string): Promise<void>;
    removeSharedWithMeNodeUid(nodeUid: string): Promise<void>;
    setSharedWithMeNodeUids(nodeUids: string[] | undefined): Promise<void>;
    /**
     * @throws Error if the cache is not set yet. First, the cache should be
     *        set by calling `setNodeUids` after full loading of the list.
     */
    private addNodeUid;
    /**
     * @throws Error if the cache is not set yet. First, the cache should be
     *        set by calling `setNodeUids` after full loading of the list.
     */
    private removeNodeUid;
    private getNodeUids;
    /**
     * @param nodeUids - Passing `undefined` will remove the cache.
     */
    private setNodeUids;
}
