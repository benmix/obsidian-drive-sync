"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodesAccess = exports.NodesAccessBase = void 0;
exports.parseNode = parseNode;
const ttag_1 = require("ttag");
const interface_1 = require("../../interface");
const errors_1 = require("../../errors");
const asyncIteratorMap_1 = require("../asyncIteratorMap");
const errors_2 = require("../errors");
const batchLoading_1 = require("../batchLoading");
const uids_1 = require("../uids");
const debouncer_1 = require("./debouncer");
const extendedAttributes_1 = require("./extendedAttributes");
const validations_1 = require("./validations");
const mediaTypes_1 = require("./mediaTypes");
// This is the number of nodes that are loaded in parallel.
// It is a trade-off between initial wait time and overhead of API calls.
const BATCH_LOADING_SIZE = 30;
// This is the number of nodes that are decrypted in parallel.
// It is a trade-off between performance and memory usage.
// Higher number means more memory usage, but faster decryption.
// Lower number means less memory usage, but slower decryption.
const DECRYPTION_CONCURRENCY = 30;
/**
 * Provides access to node metadata.
 *
 * The node access module is responsible for fetching, decrypting and caching
 * nodes metadata.
 */
class NodesAccessBase {
    telemetry;
    apiService;
    cache;
    cryptoCache;
    cryptoService;
    shareService;
    logger;
    debouncer;
    constructor(telemetry, apiService, cache, cryptoCache, cryptoService, shareService) {
        this.telemetry = telemetry;
        this.apiService = apiService;
        this.cache = cache;
        this.cryptoCache = cryptoCache;
        this.cryptoService = cryptoService;
        this.shareService = shareService;
        this.logger = telemetry.getLogger('nodes');
        this.apiService = apiService;
        this.cache = cache;
        this.cryptoCache = cryptoCache;
        this.cryptoService = cryptoService;
        this.shareService = shareService;
        this.debouncer = new debouncer_1.NodesDebouncer(this.telemetry);
    }
    async getVolumeRootFolder() {
        const { volumeId, rootNodeId } = await this.shareService.getRootIDs();
        const nodeUid = (0, uids_1.makeNodeUid)(volumeId, rootNodeId);
        return this.getNode(nodeUid);
    }
    async getNode(nodeUid) {
        let cachedNode;
        try {
            await this.debouncer.waitForLoadingNode(nodeUid);
            cachedNode = await this.cache.getNode(nodeUid);
        }
        catch { }
        if (cachedNode && !cachedNode.isStale) {
            return cachedNode;
        }
        this.logger.debug(`Node ${nodeUid} is ${cachedNode?.isStale ? 'stale' : 'not cached'}`);
        const { node } = await this.loadNode(nodeUid);
        return node;
    }
    async *iterateFolderChildren(parentNodeUid, filterOptions, signal) {
        // Ensure the parent is loaded and up-to-date.
        const parentNode = await this.getNode(parentNodeUid);
        const batchLoading = new batchLoading_1.BatchLoading({
            iterateItems: (nodeUids) => this.loadNodes(nodeUids, filterOptions, signal),
            batchSize: BATCH_LOADING_SIZE,
        });
        const areChildrenCached = await this.cache.isFolderChildrenLoaded(parentNodeUid);
        if (areChildrenCached) {
            for await (const node of this.cache.iterateChildren(parentNodeUid)) {
                if (node.ok && !node.node.isStale) {
                    if (filterOptions?.type && node.node.type !== filterOptions.type) {
                        continue;
                    }
                    yield node.node;
                }
                else {
                    yield* batchLoading.load(node.uid);
                }
            }
            yield* batchLoading.loadRest();
            return;
        }
        this.logger.debug(`Folder ${parentNodeUid} children are not cached`);
        const onlyFolders = filterOptions?.type === interface_1.NodeType.Folder;
        for await (const nodeUid of this.apiService.iterateChildrenNodeUids(parentNode.uid, onlyFolders, signal)) {
            let node;
            try {
                await this.debouncer.waitForLoadingNode(nodeUid);
                node = await this.cache.getNode(nodeUid);
            }
            catch { }
            if (node && !node.isStale) {
                if (filterOptions?.type && node.type !== filterOptions.type) {
                    continue;
                }
                yield node;
            }
            else {
                this.logger.debug(`Node ${nodeUid} from ${parentNodeUid} is ${node?.isStale ? 'stale' : 'not cached'}`);
                yield* batchLoading.load(nodeUid);
            }
        }
        yield* batchLoading.loadRest();
        // If some nodes were filtered out, we don't have the folder fully loaded.
        if (!filterOptions) {
            await this.cache.setFolderChildrenLoaded(parentNodeUid);
        }
    }
    // Improvement requested: keep status of loaded trash and leverage cache.
    async *iterateTrashedNodes(signal) {
        const { volumeId } = await this.shareService.getRootIDs();
        const batchLoading = new batchLoading_1.BatchLoading({
            iterateItems: (nodeUids) => this.loadNodes(nodeUids, undefined, signal),
            batchSize: BATCH_LOADING_SIZE,
        });
        for await (const nodeUid of this.apiService.iterateTrashedNodeUids(volumeId, signal)) {
            let node;
            try {
                await this.debouncer.waitForLoadingNode(nodeUid);
                node = await this.cache.getNode(nodeUid);
            }
            catch { }
            if (node && !node.isStale) {
                yield node;
            }
            else {
                this.logger.debug(`Node ${nodeUid} trom trash is ${node?.isStale ? 'stale' : 'not cached'}`);
                yield* batchLoading.load(nodeUid);
            }
        }
        yield* batchLoading.loadRest();
    }
    async *iterateNodes(nodeUids, signal) {
        const batchLoading = new batchLoading_1.BatchLoading({
            iterateItems: (nodeUids) => this.loadNodesWithMissingReport(nodeUids, undefined, signal),
            batchSize: BATCH_LOADING_SIZE,
        });
        for await (const result of this.cache.iterateNodes(nodeUids)) {
            if (result.ok && !result.node.isStale) {
                yield result.node;
            }
            else {
                yield* batchLoading.load(result.uid);
            }
        }
        yield* batchLoading.loadRest();
    }
    /**
     * Call to invalidate the folder listing cache. This should be refactored into a clean
     * cache layer once the cache is split off.
     */
    async notifyChildCreated(nodeUid) {
        await this.cache.resetFolderChildrenLoaded(nodeUid);
    }
    /**
     * Call to invalidate the node cache when a node changes. Parent can be set after a move
     * to ensure parent listing of new parent is up to date if cached.
     * This should be refactored into a clean cache layer once the cache is split off.
     */
    async notifyNodeChanged(nodeUid, newParentUid) {
        try {
            const node = await this.cache.getNode(nodeUid);
            if (node.isStale && newParentUid === null) {
                return;
            }
            node.isStale = true;
            if (newParentUid) {
                node.parentUid = newParentUid;
            }
            await this.cache.setNode(node);
        }
        catch (error) {
            this.logger.warn(`Failed to set node ${nodeUid} as stale after sharing: ${error}`);
        }
    }
    /**
     * Call to remove a node from cache. This should be refactored when the cache is split off.
     */
    async notifyNodeDeleted(nodeUid) {
        await this.cache.removeNodes([nodeUid]);
    }
    async loadNode(nodeUid) {
        this.debouncer.loadingNode(nodeUid);
        try {
            const ownVolumeId = await this.getOwnVolumeId();
            const encryptedNode = await this.apiService.getNode(nodeUid, ownVolumeId);
            return this.decryptNode(encryptedNode);
        }
        finally {
            this.debouncer.finishedLoadingNode(nodeUid);
        }
    }
    async *loadNodes(nodeUids, filterOptions, signal) {
        for await (const result of this.loadNodesWithMissingReport(nodeUids, filterOptions, signal)) {
            if ('missingUid' in result) {
                continue;
            }
            yield result;
        }
    }
    async getOwnVolumeId() {
        const { volumeId } = await this.shareService.getRootIDs();
        return volumeId;
    }
    async *loadNodesWithMissingReport(nodeUids, filterOptions, signal) {
        const returnedNodeUids = [];
        const errors = [];
        const ownVolumeId = await this.getOwnVolumeId();
        const apiNodesIterator = this.apiService.iterateNodes(nodeUids, ownVolumeId, filterOptions, signal);
        const debouncedNodeMapper = async (encryptedNode) => {
            this.debouncer.loadingNode(encryptedNode.uid);
            return encryptedNode;
        };
        const encryptedNodesIterator = (0, asyncIteratorMap_1.asyncIteratorMap)(apiNodesIterator, debouncedNodeMapper, 1);
        const decryptNodeMapper = async (encryptedNode) => {
            returnedNodeUids.push(encryptedNode.uid);
            try {
                const { node } = await this.decryptNode(encryptedNode);
                return (0, interface_1.resultOk)(node);
            }
            catch (error) {
                return (0, interface_1.resultError)(error);
            }
        };
        const decryptedNodesIterator = (0, asyncIteratorMap_1.asyncIteratorMap)(encryptedNodesIterator, decryptNodeMapper, DECRYPTION_CONCURRENCY, signal);
        for await (const node of decryptedNodesIterator) {
            if (node.ok) {
                yield node.value;
            }
            else {
                errors.push(node.error);
            }
        }
        if (errors.length > 0) {
            this.logger.error(`Failed to decrypt ${errors.length} nodes`, errors);
            throw new errors_1.DecryptionError((0, ttag_1.c)('Error').t `Failed to decrypt some nodes`, { cause: errors });
        }
        const missingNodeUids = nodeUids.filter((nodeUid) => !returnedNodeUids.includes(nodeUid));
        if (missingNodeUids.length) {
            this.logger.debug(`Removing ${missingNodeUids.length} nodes from cache not existing on the API anymore`);
            await this.cache.removeNodes(missingNodeUids);
            for (const missingNodeUid of missingNodeUids) {
                yield { missingUid: missingNodeUid };
            }
        }
    }
    async decryptNode(encryptedNode) {
        let parentKey;
        try {
            const parentKeys = await this.getParentKeys(encryptedNode);
            parentKey = parentKeys.key;
        }
        catch (error) {
            if (error instanceof errors_1.DecryptionError) {
                return {
                    node: this.getDegradedUndecryptableNode(encryptedNode, error),
                };
            }
            throw error;
        }
        const { node: unparsedNode, keys } = await this.cryptoService.decryptNode(encryptedNode, parentKey);
        const node = this.parseNode(unparsedNode);
        try {
            await this.cache.setNode(node);
        }
        catch (error) {
            this.logger.error(`Failed to cache node ${node.uid}`, error);
        }
        if (keys) {
            try {
                await this.cryptoCache.setNodeKeys(node.uid, keys);
            }
            catch (error) {
                this.logger.error(`Failed to cache node keys ${node.uid}`, error);
            }
        }
        this.debouncer.finishedLoadingNode(node.uid);
        return { node, keys };
    }
    getDegradedUndecryptableNodeBase(encryptedNode, error) {
        return {
            ...encryptedNode,
            isStale: false,
            name: (0, interface_1.resultError)(error),
            keyAuthor: (0, interface_1.resultError)({
                claimedAuthor: encryptedNode.encryptedCrypto.signatureEmail,
                error: (0, errors_2.getErrorMessage)(error),
            }),
            nameAuthor: (0, interface_1.resultError)({
                claimedAuthor: encryptedNode.encryptedCrypto.nameSignatureEmail,
                error: (0, errors_2.getErrorMessage)(error),
            }),
            membership: encryptedNode.membership
                ? {
                    role: encryptedNode.membership.role,
                    inviteTime: encryptedNode.membership.inviteTime,
                    sharedBy: (0, interface_1.resultError)({
                        claimedAuthor: encryptedNode.encryptedCrypto.membership?.inviterEmail,
                        error: (0, errors_2.getErrorMessage)(error),
                    }),
                }
                : undefined,
            errors: [error],
            treeEventScopeId: (0, uids_1.splitNodeUid)(encryptedNode.uid).volumeId,
        };
    }
    async getParentKeys(node) {
        if (node.parentUid) {
            try {
                return await this.getNodeKeys(node.parentUid);
            }
            catch (error) {
                if (error instanceof errors_1.DecryptionError) {
                    // Change the error message to be more specific.
                    // Original error message is referring to node, while here
                    // it referes to as parent to follow the method context.
                    throw new errors_1.DecryptionError((0, ttag_1.c)('Error').t `Parent cannot be decrypted`, { cause: error });
                }
                throw error;
            }
        }
        if (node.shareId) {
            return {
                key: await this.shareService.getSharePrivateKey(node.shareId),
            };
        }
        // This is bug that should not happen.
        // API cannot provide node without parent or share.
        throw new Error('Node has neither parent node nor share');
    }
    async getNodeKeys(nodeUid) {
        try {
            await this.debouncer.waitForLoadingNode(nodeUid);
            return await this.cryptoCache.getNodeKeys(nodeUid);
        }
        catch {
            const { keys } = await this.loadNode(nodeUid);
            if (!keys) {
                throw new errors_1.DecryptionError((0, ttag_1.c)('Error').t `Item cannot be decrypted`);
            }
            return keys;
        }
    }
    async getNodePrivateAndSessionKeys(nodeUid) {
        const node = await this.getNode(nodeUid);
        const { key: parentKey } = await this.getParentKeys(node);
        const { key, passphrase, passphraseSessionKey, contentKeyPacketSessionKey } = await this.getNodeKeys(nodeUid);
        const nameSessionKey = await this.cryptoService.getNameSessionKey(node, parentKey);
        return {
            key,
            passphrase,
            passphraseSessionKey,
            contentKeyPacketSessionKey,
            nameSessionKey,
        };
    }
    async getNodeSigningKeys(uids) {
        const contextNodeUid = uids.nodeUid || uids.parentNodeUid;
        if (!contextNodeUid) {
            throw new Error('Context node UID is required for signing keys');
        }
        const address = await this.getRootNodeEmailKey(contextNodeUid);
        return {
            type: 'userAddress',
            email: address.email,
            addressId: address.addressId,
            key: address.addressKey,
        };
    }
    async getRootNodeEmailKey(nodeUid) {
        const rootNode = await this.getRootNode(nodeUid);
        if (!rootNode.shareId) {
            throw new Error(`Node "${nodeUid}" is not accessible - missing root shareId`);
        }
        return this.shareService.getContextShareMemberEmailKey(rootNode.shareId);
    }
    async getNodeUrl(nodeUid) {
        const node = await this.getNode(nodeUid);
        if ((0, mediaTypes_1.isProtonDocument)(node.mediaType) || (0, mediaTypes_1.isProtonSheet)(node.mediaType)) {
            const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
            const type = (0, mediaTypes_1.isProtonDocument)(node.mediaType) ? 'doc' : 'sheet';
            return `https://docs.proton.me/doc?type=${type}&mode=open&volumeId=${volumeId}&linkId=${nodeId}`;
        }
        const rootNode = await this.getRootNode(nodeUid);
        if (!rootNode.shareId) {
            throw new errors_1.ProtonDriveError((0, ttag_1.c)('Error').t `Node is not accessible`);
        }
        const { nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const type = node.type === interface_1.NodeType.File ? 'file' : 'folder';
        return `https://drive.proton.me/${rootNode.shareId}/${type}/${nodeId}`;
    }
    async getRootNode(nodeUid) {
        const node = await this.getNode(nodeUid);
        return node.parentUid ? this.getRootNode(node.parentUid) : node;
    }
}
exports.NodesAccessBase = NodesAccessBase;
class NodesAccess extends NodesAccessBase {
    getDegradedUndecryptableNode(encryptedNode, error) {
        return this.getDegradedUndecryptableNodeBase(encryptedNode, error);
    }
    parseNode(unparsedNode) {
        return parseNode(this.logger, unparsedNode);
    }
}
exports.NodesAccess = NodesAccess;
function parseNode(logger, unparsedNode) {
    let nodeName = unparsedNode.name;
    if (unparsedNode.name.ok) {
        try {
            (0, validations_1.validateNodeName)(unparsedNode.name.value);
        }
        catch (error) {
            logger.warn(`Node name validation failed: ${error instanceof Error ? error.message : error}`);
            nodeName = (0, interface_1.resultError)({
                name: unparsedNode.name.value,
                error: error instanceof Error ? error.message : (0, ttag_1.c)('Error').t `Unknown error`,
            });
        }
    }
    const treeEventScopeId = (0, uids_1.splitNodeUid)(unparsedNode.uid).volumeId;
    if (unparsedNode.type === interface_1.NodeType.File) {
        const extendedAttributes = unparsedNode.activeRevision?.ok
            ? (0, extendedAttributes_1.parseFileExtendedAttributes)(logger, unparsedNode.activeRevision.value.creationTime, unparsedNode.activeRevision.value.extendedAttributes)
            : undefined;
        return {
            ...unparsedNode,
            isStale: false,
            activeRevision: !unparsedNode.activeRevision?.ok
                ? unparsedNode.activeRevision
                : (0, interface_1.resultOk)({
                    uid: unparsedNode.activeRevision.value.uid,
                    state: unparsedNode.activeRevision.value.state,
                    creationTime: unparsedNode.activeRevision.value.creationTime,
                    storageSize: unparsedNode.activeRevision.value.storageSize,
                    contentAuthor: unparsedNode.activeRevision.value.contentAuthor,
                    thumbnails: unparsedNode.activeRevision.value.thumbnails,
                    ...extendedAttributes,
                }),
            folder: undefined,
            treeEventScopeId,
        };
    }
    const extendedAttributes = unparsedNode.folder?.extendedAttributes
        ? (0, extendedAttributes_1.parseFolderExtendedAttributes)(logger, unparsedNode.folder.extendedAttributes)
        : undefined;
    return {
        ...unparsedNode,
        name: nodeName,
        isStale: false,
        activeRevision: undefined,
        folder: extendedAttributes,
        treeEventScopeId,
    };
}
//# sourceMappingURL=nodesAccess.js.map