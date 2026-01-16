"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotosTimeline = void 0;
const uids_1 = require("../uids");
/**
 * Provides access to the photo timeline.
 */
class PhotosTimeline {
    logger;
    apiService;
    driveCrypto;
    photoShares;
    nodesService;
    constructor(logger, apiService, driveCrypto, photoShares, nodesService) {
        this.logger = logger;
        this.apiService = apiService;
        this.driveCrypto = driveCrypto;
        this.photoShares = photoShares;
        this.nodesService = nodesService;
        this.logger = logger;
        this.apiService = apiService;
        this.driveCrypto = driveCrypto;
        this.photoShares = photoShares;
        this.nodesService = nodesService;
    }
    async *iterateTimeline(signal) {
        const { volumeId } = await this.photoShares.getRootIDs();
        yield* this.apiService.iterateTimeline(volumeId, signal);
    }
    async findPhotoDuplicates(name, generateSha1, signal) {
        const { volumeId, rootNodeId } = await this.photoShares.getRootIDs();
        const rootNodeUid = (0, uids_1.makeNodeUid)(volumeId, rootNodeId);
        const { hashKey } = await this.nodesService.getNodeKeys(rootNodeUid);
        if (!hashKey) {
            throw new Error('Hash key of photo root node not found');
        }
        const nameHash = await this.driveCrypto.generateLookupHash(name, hashKey);
        const duplicates = await this.apiService.checkPhotoDuplicates(volumeId, [nameHash], signal);
        if (duplicates.length === 0) {
            return [];
        }
        // Generate the SHA1 only when there is any matching node hash to avoid
        // computing it for every node as in most cases there is no match.
        const sha1 = await generateSha1();
        const contentHash = await this.driveCrypto.generateLookupHash(sha1, hashKey);
        const matchingDuplicates = duplicates.filter((duplicate) => duplicate.nameHash === nameHash && duplicate.contentHash === contentHash);
        if (matchingDuplicates.length === 0) {
            return [];
        }
        const nodeUids = matchingDuplicates.map((duplicate) => duplicate.nodeUid);
        this.logger.debug(`Duplicate photo found: name hash: ${nameHash}, content hash: ${contentHash}, node uids: ${nodeUids}`);
        return nodeUids;
    }
}
exports.PhotosTimeline = PhotosTimeline;
//# sourceMappingURL=timeline.js.map