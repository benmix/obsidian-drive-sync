"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Albums = void 0;
const batchLoading_1 = require("../batchLoading");
const BATCH_LOADING_SIZE = 10;
/**
 * Provides access and high-level actions for managing albums.
 */
class Albums {
    apiService;
    photoShares;
    nodesService;
    constructor(apiService, photoShares, nodesService) {
        this.apiService = apiService;
        this.photoShares = photoShares;
        this.nodesService = nodesService;
        this.apiService = apiService;
        this.photoShares = photoShares;
        this.nodesService = nodesService;
    }
    async *iterateAlbums(signal) {
        const { volumeId } = await this.photoShares.getRootIDs();
        const batchLoading = new batchLoading_1.BatchLoading({
            iterateItems: (nodeUids) => this.iterateNodesAndIgnoreMissingOnes(nodeUids, signal),
            batchSize: BATCH_LOADING_SIZE,
        });
        for await (const album of this.apiService.iterateAlbums(volumeId, signal)) {
            yield* batchLoading.load(album.albumUid);
        }
        yield* batchLoading.loadRest();
    }
    async *iterateNodesAndIgnoreMissingOnes(nodeUids, signal) {
        const nodeGenerator = this.nodesService.iterateNodes(nodeUids, signal);
        for await (const node of nodeGenerator) {
            if ('missingUid' in node) {
                continue;
            }
            yield node;
        }
    }
}
exports.Albums = Albums;
//# sourceMappingURL=albums.js.map