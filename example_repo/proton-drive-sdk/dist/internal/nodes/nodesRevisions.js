"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodesRevisons = void 0;
const uids_1 = require("../uids");
const extendedAttributes_1 = require("./extendedAttributes");
/**
 * Provides access to revisions metadata.
 */
class NodesRevisons {
    logger;
    apiService;
    cryptoService;
    nodesAccess;
    constructor(logger, apiService, cryptoService, nodesAccess) {
        this.logger = logger;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.nodesAccess = nodesAccess;
        this.logger = logger;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.nodesAccess = nodesAccess;
    }
    async getRevision(nodeRevisionUid) {
        const nodeUid = (0, uids_1.makeNodeUidFromRevisionUid)(nodeRevisionUid);
        const { key } = await this.nodesAccess.getNodeKeys(nodeUid);
        const encryptedRevision = await this.apiService.getRevision(nodeRevisionUid);
        const revision = await this.cryptoService.decryptRevision(nodeUid, encryptedRevision, key);
        const extendedAttributes = (0, extendedAttributes_1.parseFileExtendedAttributes)(this.logger, revision.creationTime, revision.extendedAttributes);
        return {
            ...revision,
            ...extendedAttributes,
        };
    }
    async *iterateRevisions(nodeUid, signal) {
        const { key } = await this.nodesAccess.getNodeKeys(nodeUid);
        const encryptedRevisions = await this.apiService.getRevisions(nodeUid, signal);
        for (const encryptedRevision of encryptedRevisions) {
            const revision = await this.cryptoService.decryptRevision(nodeUid, encryptedRevision, key);
            const extendedAttributes = (0, extendedAttributes_1.parseFileExtendedAttributes)(this.logger, revision.creationTime, revision.extendedAttributes);
            yield {
                ...revision,
                ...extendedAttributes,
            };
        }
    }
    async restoreRevision(nodeRevisionUid) {
        await this.apiService.restoreRevision(nodeRevisionUid);
    }
    async deleteRevision(nodeRevisionUid) {
        await this.apiService.deleteRevision(nodeRevisionUid);
    }
}
exports.NodesRevisons = NodesRevisons;
//# sourceMappingURL=nodesRevisions.js.map