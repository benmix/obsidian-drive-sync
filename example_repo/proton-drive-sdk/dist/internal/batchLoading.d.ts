/**
 * Helper class for batch loading items.
 *
 * The class is responsible for fetching items in batches. Any call to
 * `load` will add the item to the batch (without fetching anything),
 * and if the batch reaches the limit, it will fetch the items and yield
 * them transparently to the caller.
 *
 * Example:
 *
 * ```typescript
 * const batchLoading = new BatchLoading<string, DecryptedNode>({ loadItems: loadNodesCallback });
 * for (const nodeUid of nodeUids) {
 *   for await (const node of batchLoading.load(nodeUid)) {
 *     console.log(node);
 *   }
 * }
 * for await (const node of batchLoading.loadRest()) {
 *  console.log(node);
 * }
 * ```
 */
export declare class BatchLoading<ID, ITEM> {
    private batchSize;
    private iterateItems;
    private itemsToFetch;
    constructor(options: {
        loadItems?: (ids: ID[]) => Promise<ITEM[]>;
        iterateItems?: (ids: ID[]) => AsyncGenerator<ITEM>;
        batchSize?: number;
    });
    load(nodeUid: ID): AsyncGenerator<Awaited<ITEM>, void, any>;
    loadRest(): AsyncGenerator<Awaited<ITEM>, void, any>;
}
