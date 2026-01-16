import { EntityResult } from '../../cache';
import { ProtonDriveEntitiesCache, Logger } from '../../interface';
import { DecryptedNode } from './interface';
export declare enum CACHE_TAG_KEYS {
    ParentUid = "nodeParentUid",
    Trashed = "nodeTrashed",
    Roots = "nodeRoot"
}
type DecryptedNodeResult<T extends DecryptedNode> = {
    uid: string;
    ok: true;
    node: T;
} | {
    uid: string;
    ok: false;
    error: string;
};
/**
 * Provides caching for nodes metadata.
 *
 * The cache is responsible for serialising and deserialising node metadata,
 * recording parent-child relationships, and recursively removing nodes.
 *
 * The cache of node metadata should not contain any crypto material.
 */
export declare abstract class NodesCacheBase<T extends DecryptedNode = DecryptedNode> {
    private logger;
    private driveCache;
    constructor(logger: Logger, driveCache: ProtonDriveEntitiesCache);
    setNode(node: T): Promise<void>;
    getNode(nodeUid: string): Promise<T>;
    protected abstract serialiseNode(node: T): string;
    protected abstract deserialiseNode(nodeData: string): T;
    /**
     * Set all nodes on given node as stale. This is useful when we
     * get refresh event from the server and we thus don't know
     * which nodes were up-to-date anymore.
     */
    setNodesStaleFromVolume(volumeId: string): Promise<void>;
    /**
     * Remove all entries associated with a volume.
     *
     * This is needed when a user looses access to a volume.
     */
    removeVolume(volumeId: string): Promise<void>;
    /**
     * Remove corrupted node never throws, but it logs so we can know
     * about issues and fix them. It is crucial to remove corrupted
     * nodes and rather let SDK re-fetch them than to auotmatically
     * fix issues and do not bother user with it.
     */
    private removeCorruptedNode;
    removeNodes(nodeUids: string[]): Promise<void>;
    private getRecursiveChildrenCacheUids;
    iterateNodes(nodeUids: string[]): AsyncGenerator<DecryptedNodeResult<T>>;
    iterateChildren(parentNodeUid: string): AsyncGenerator<DecryptedNodeResult<T>>;
    iterateRootNodeUids(volumeId: string): AsyncGenerator<EntityResult<string>>;
    iterateTrashedNodes(): AsyncGenerator<DecryptedNodeResult<T>>;
    /**
     * Converts result from the cache with cache UID and data to result of node
     * with node UID and DecryptedNode.
     */
    private convertCacheResult;
    setFolderChildrenLoaded(nodeUid: string): Promise<void>;
    resetFolderChildrenLoaded(nodeUid: string): Promise<void>;
    isFolderChildrenLoaded(nodeUid: string): Promise<boolean>;
}
export declare class NodesCache extends NodesCacheBase<DecryptedNode> {
    protected serialiseNode(node: DecryptedNode): string;
    protected deserialiseNode(nodeData: string): DecryptedNode;
}
export declare function serialiseNode(node: DecryptedNode): string;
export declare function deserialiseNode(nodeData: string): DecryptedNode;
export {};
