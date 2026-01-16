"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchLoading = void 0;
const DEFAULT_BATCH_LOADING = 10;
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
class BatchLoading {
    batchSize = DEFAULT_BATCH_LOADING;
    iterateItems;
    itemsToFetch;
    constructor(options) {
        this.itemsToFetch = [];
        if (options.loadItems) {
            const loadItems = options.loadItems;
            this.iterateItems = async function* (ids) {
                for (const item of await loadItems(ids)) {
                    yield item;
                }
            };
        }
        else if (options.iterateItems) {
            this.iterateItems = options.iterateItems;
        }
        else {
            // This is developer error.
            throw new Error('Either loadItems or iterateItems must be provided');
        }
        if (options.batchSize) {
            this.batchSize = options.batchSize;
        }
    }
    async *load(nodeUid) {
        this.itemsToFetch.push(nodeUid);
        if (this.itemsToFetch.length >= this.batchSize) {
            yield* this.iterateItems(this.itemsToFetch);
            this.itemsToFetch = [];
        }
    }
    async *loadRest() {
        if (this.itemsToFetch.length === 0) {
            return;
        }
        yield* this.iterateItems(this.itemsToFetch);
        this.itemsToFetch = [];
    }
}
exports.BatchLoading = BatchLoading;
//# sourceMappingURL=batchLoading.js.map