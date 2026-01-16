"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingPublicNodesManagement = exports.SharingPublicNodesAccess = exports.SharingPublicNodesAPIService = void 0;
const apiService_1 = require("../nodes/apiService");
const nodesAccess_1 = require("../nodes/nodesAccess");
const nodesManagement_1 = require("../nodes/nodesManagement");
const mediaTypes_1 = require("../nodes/mediaTypes");
const uids_1 = require("../uids");
/**
 * Custom API service for public links that handles permission injection.
 *
 * TEMPORARY: This is a workaround for the backend sending DirectPermissions as null
 * for public requests.
 *
 * The service injects publicPermissions into the root node's directRole to ensure
 * correct permission handling throughout the SDK.
 */
class SharingPublicNodesAPIService extends apiService_1.NodeAPIService {
    publicRootNodeUid;
    publicRole;
    constructor(logger, apiService, clientUid, publicRootNodeUid, publicRole) {
        super(logger, apiService, clientUid);
        this.publicRootNodeUid = publicRootNodeUid;
        this.publicRole = publicRole;
        this.publicRootNodeUid = publicRootNodeUid;
        this.publicRole = publicRole;
    }
    linkToEncryptedNode(volumeId, link, isOwnVolumeId) {
        const nodeUid = (0, uids_1.makeNodeUid)(volumeId, link.Link.LinkID);
        const encryptedNode = (0, apiService_1.linkToEncryptedNode)(this.logger, volumeId, link, isOwnVolumeId);
        // TEMPORARY: Inject public permissions for the root node only.
        // This ensures the root node has the correct directRole instead of
        // incorrectly falling back to 'admin' due to null DirectPermissions.
        // May be fixed by backend later.
        if (this.publicRootNodeUid === nodeUid) {
            encryptedNode.directRole = this.publicRole;
        }
        return encryptedNode;
    }
}
exports.SharingPublicNodesAPIService = SharingPublicNodesAPIService;
class SharingPublicNodesAccess extends nodesAccess_1.NodesAccess {
    url;
    token;
    publicShareKey;
    publicRootNodeUid;
    isAnonymousContext;
    constructor(telemetry, apiService, cache, cryptoCache, cryptoService, sharesService, url, token, publicShareKey, publicRootNodeUid, isAnonymousContext) {
        super(telemetry, apiService, cache, cryptoCache, cryptoService, sharesService);
        this.url = url;
        this.token = token;
        this.publicShareKey = publicShareKey;
        this.publicRootNodeUid = publicRootNodeUid;
        this.isAnonymousContext = isAnonymousContext;
        this.token = token;
        this.publicShareKey = publicShareKey;
        this.publicRootNodeUid = publicRootNodeUid;
        this.isAnonymousContext = isAnonymousContext;
    }
    /**
     * Returns undefined for public link context to prevent incorrect volume ownership detection.
     *
     * TEMPORARY: When requesting nodes in public link context, we need to ensure nodes are not
     * incorrectly marked as owned by the user. In public context (especially for anonymous users),
     * there is no "own volume", so we return undefined to prevent the SDK from comparing
     * volumeId === ownVolumeId and incorrectly granting admin permissions.
     * May be fixed by backend later.
     */
    async getOwnVolumeId() {
        return undefined;
    }
    async getParentKeys(node) {
        // If we reached the root node of the public link, return the public
        // share key even if user has access to the parent node. We do not
        // support access to nodes outside of the public link context.
        // For other nodes, the client must use the main SDK.
        if (node.uid === this.publicRootNodeUid) {
            return {
                key: this.publicShareKey,
            };
        }
        return super.getParentKeys(node);
    }
    async getNodeUrl(nodeUid) {
        const node = await this.getNode(nodeUid);
        if ((0, mediaTypes_1.isProtonDocument)(node.mediaType) || (0, mediaTypes_1.isProtonSheet)(node.mediaType)) {
            const { nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
            const type = (0, mediaTypes_1.isProtonDocument)(node.mediaType) ? 'doc' : 'sheet';
            return `https://docs.proton.me/doc?type=${type}&mode=open-url&token=${this.token}&linkId=${nodeId}`;
        }
        // Public link doesn't support specific node URLs.
        return this.url;
    }
    async getNodeSigningKeys(uids) {
        if (this.isAnonymousContext) {
            const nodeKeys = uids.nodeUid ? await this.getNodeKeys(uids.nodeUid) : { key: undefined };
            const parentNodeKeys = uids.parentNodeUid ? await this.getNodeKeys(uids.parentNodeUid) : { key: undefined };
            return {
                type: 'nodeKey',
                nodeKey: nodeKeys.key,
                parentNodeKey: parentNodeKeys.key,
            };
        }
        return super.getNodeSigningKeys(uids);
    }
}
exports.SharingPublicNodesAccess = SharingPublicNodesAccess;
class SharingPublicNodesManagement extends nodesManagement_1.NodesManagement {
    constructor(apiService, cryptoCache, cryptoService, nodesAccess) {
        super(apiService, cryptoCache, cryptoService, nodesAccess);
    }
    async *deleteMyNodes(nodeUids, signal) {
        // Public link does not support trashing and deleting trashed nodes.
        // Instead, if user is owner, API allows directly deleting existing nodes.
        for await (const result of this.apiService.deleteMyNodes(nodeUids, signal)) {
            if (result.ok) {
                await this.nodesAccess.notifyNodeDeleted(result.uid);
            }
            yield result;
        }
    }
}
exports.SharingPublicNodesManagement = SharingPublicNodesManagement;
//# sourceMappingURL=nodes.js.map