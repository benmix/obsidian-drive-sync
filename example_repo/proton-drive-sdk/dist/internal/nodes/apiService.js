"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeAPIService = exports.NodeAPIServiceBase = void 0;
exports.linkToEncryptedNode = linkToEncryptedNode;
exports.linkToEncryptedNodeBaseMetadata = linkToEncryptedNodeBaseMetadata;
exports.groupNodeUidsByVolumeAndIteratePerBatch = groupNodeUidsByVolumeAndIteratePerBatch;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
const interface_1 = require("../../interface");
const apiService_1 = require("../apiService");
const asyncIteratorRace_1 = require("../asyncIteratorRace");
const batch_1 = require("../batch");
const uids_1 = require("../uids");
const errors_2 = require("./errors");
// This is the number of calls to the API that are made in parallel.
const API_CONCURRENCY = 15;
// This is the number of nodes that are loaded from the API in one call.
const API_NODES_BATCH_SIZE = 100;
var APIRevisionState;
(function (APIRevisionState) {
    APIRevisionState[APIRevisionState["Draft"] = 0] = "Draft";
    APIRevisionState[APIRevisionState["Active"] = 1] = "Active";
    APIRevisionState[APIRevisionState["Obsolete"] = 2] = "Obsolete";
})(APIRevisionState || (APIRevisionState = {}));
/**
 * Provides API communication for fetching and manipulating nodes metadata.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
class NodeAPIServiceBase {
    logger;
    apiService;
    clientUid;
    constructor(logger, apiService, clientUid) {
        this.logger = logger;
        this.apiService = apiService;
        this.clientUid = clientUid;
        this.logger = logger;
        this.apiService = apiService;
        this.clientUid = clientUid;
    }
    async getNode(nodeUid, ownVolumeId, signal) {
        const nodesGenerator = this.iterateNodes([nodeUid], ownVolumeId, undefined, signal);
        const result = await nodesGenerator.next();
        if (!result.value) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Node not found`);
        }
        await nodesGenerator.return('finish');
        return result.value;
    }
    async *iterateNodes(nodeUids, ownVolumeId, filterOptions, signal) {
        const allNodeIds = nodeUids.map(uids_1.splitNodeUid);
        const nodeIdsByVolumeId = new Map();
        for (const { volumeId, nodeId } of allNodeIds) {
            if (!nodeIdsByVolumeId.has(volumeId)) {
                nodeIdsByVolumeId.set(volumeId, []);
            }
            nodeIdsByVolumeId.get(volumeId)?.push(nodeId);
        }
        // If the API returns node that is not recognised, it is returned as
        // an error, but first all nodes that are recognised are yielded.
        // Thus we capture all errors and throw them at the end of iteration.
        const errors = [];
        const iterateNodesPerVolume = this.iterateNodesPerVolume.bind(this);
        const iterateNodesPerVolumeGenerator = async function* () {
            for (const [volumeId, nodeIds] of nodeIdsByVolumeId.entries()) {
                const isAdmin = volumeId === ownVolumeId;
                yield (async function* () {
                    const errorsPerVolume = yield* iterateNodesPerVolume(volumeId, nodeIds, isAdmin, filterOptions, signal);
                    if (errorsPerVolume.length) {
                        errors.push(...errorsPerVolume);
                    }
                })();
            }
        };
        yield* (0, asyncIteratorRace_1.asyncIteratorRace)(iterateNodesPerVolumeGenerator(), API_CONCURRENCY);
        if (errors.length) {
            this.logger.warn(`Failed to load ${errors.length} nodes`);
            throw new errors_1.ProtonDriveError((0, ttag_1.c)('Error').t `Failed to load some nodes`, { cause: errors });
        }
    }
    async *iterateNodesPerVolume(volumeId, nodeIds, isOwnVolumeId, filterOptions, signal) {
        const errors = [];
        for (const nodeIdsBatch of (0, batch_1.batch)(nodeIds, API_NODES_BATCH_SIZE)) {
            const responseLinks = await this.fetchNodeMetadata(volumeId, nodeIdsBatch, signal);
            for (const link of responseLinks) {
                try {
                    const encryptedNode = this.linkToEncryptedNode(volumeId, link, isOwnVolumeId);
                    if (filterOptions?.type && encryptedNode.type !== filterOptions.type) {
                        continue;
                    }
                    yield encryptedNode;
                }
                catch (error) {
                    this.logger.error(`Failed to transform node ${link.Link.LinkID}`, error);
                    errors.push(error);
                }
            }
        }
        return errors;
    }
    // Improvement requested: load next page sooner before all IDs are yielded.
    async *iterateChildrenNodeUids(parentNodeUid, onlyFolders = false, signal) {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(parentNodeUid);
        let anchor = '';
        while (true) {
            const queryParams = new URLSearchParams();
            if (onlyFolders) {
                queryParams.set('FoldersOnly', '1');
            }
            if (anchor) {
                queryParams.set('AnchorID', anchor);
            }
            const response = await this.apiService.get(`drive/v2/volumes/${volumeId}/folders/${nodeId}/children?${queryParams.toString()}`, signal);
            for (const linkID of response.LinkIDs) {
                yield (0, uids_1.makeNodeUid)(volumeId, linkID);
            }
            if (!response.More || !response.AnchorID) {
                break;
            }
            anchor = response.AnchorID;
        }
    }
    // Improvement requested: load next page sooner before all IDs are yielded.
    async *iterateTrashedNodeUids(volumeId, signal) {
        let page = 0;
        while (true) {
            const response = await this.apiService.get(`drive/volumes/${volumeId}/trash?Page=${page}`, signal);
            // The API returns items per shares which is not straightforward to
            // count if there is another page. We had mistakes in the past, thus
            // we rather end when the page is fully empty.
            // The new API endpoint should not split per shares anymore and adopt
            // the new pagination model with More/Anchor. For now, this is not
            // the most efficient way, but should be with us only for a short time.
            let hasItems = false;
            for (const linksPerShare of response.Trash) {
                for (const linkId of linksPerShare.LinkIDs) {
                    yield (0, uids_1.makeNodeUid)(volumeId, linkId);
                    hasItems = true;
                }
            }
            if (!hasItems) {
                break;
            }
            page++;
        }
    }
    async renameNode(nodeUid, originalNode, newNode, signal) {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
        try {
            await this.apiService.put(`drive/v2/volumes/${volumeId}/links/${nodeId}/rename`, {
                Name: newNode.encryptedName,
                NameSignatureEmail: newNode.nameSignatureEmail,
                Hash: newNode.hash,
                OriginalHash: originalNode.hash || null,
            }, signal);
        }
        catch (error) {
            // API returns generic code 2000 when node is out of sync.
            // We map this to specific error for clarity.
            if (error instanceof apiService_1.InvalidRequirementsAPIError) {
                throw new errors_2.NodeOutOfSyncError(error.message, error.code, { cause: error });
            }
            throw error;
        }
    }
    async moveNode(nodeUid, oldNode, newNode, signal) {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const { nodeId: newParentNodeId } = (0, uids_1.splitNodeUid)(newNode.parentUid);
        try {
            await this.apiService.put(`drive/v2/volumes/${volumeId}/links/${nodeId}/move`, {
                ParentLinkID: newParentNodeId,
                NodePassphrase: newNode.armoredNodePassphrase,
                // @ts-expect-error: API accepts NodePassphraseSignature as optional.
                NodePassphraseSignature: newNode.armoredNodePassphraseSignature,
                // @ts-expect-error: API accepts SignatureEmail as optional.
                SignatureEmail: newNode.signatureEmail,
                Name: newNode.encryptedName,
                // @ts-expect-error: API accepts NameSignatureEmail as optional.
                NameSignatureEmail: newNode.nameSignatureEmail,
                Hash: newNode.hash,
                OriginalHash: oldNode.hash,
                ContentHash: newNode.contentHash || null,
            }, signal);
        }
        catch (error) {
            handleNodeWithSameNameExistsValidationError(volumeId, error);
            throw error;
        }
    }
    async copyNode(nodeUid, newNode, signal) {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const { volumeId: parentVolumeId, nodeId: parentNodeId } = (0, uids_1.splitNodeUid)(newNode.parentUid);
        let response;
        try {
            response = await this.apiService.post(`drive/volumes/${volumeId}/links/${nodeId}/copy`, {
                TargetVolumeID: parentVolumeId,
                TargetParentLinkID: parentNodeId,
                NodePassphrase: newNode.armoredNodePassphrase,
                // @ts-expect-error: API accepts NodePassphraseSignature as optional.
                NodePassphraseSignature: newNode.armoredNodePassphraseSignature,
                // @ts-expect-error: API accepts SignatureEmail as optional.
                SignatureEmail: newNode.signatureEmail,
                Name: newNode.encryptedName,
                // @ts-expect-error: API accepts NameSignatureEmail as optional.
                NameSignatureEmail: newNode.nameSignatureEmail,
                Hash: newNode.hash,
            }, signal);
        }
        catch (error) {
            handleNodeWithSameNameExistsValidationError(volumeId, error);
            throw error;
        }
        return (0, uids_1.makeNodeUid)(volumeId, response.LinkID);
    }
    async *trashNodes(nodeUids, signal) {
        for (const { volumeId, batchNodeIds, batchNodeUids } of groupNodeUidsByVolumeAndIteratePerBatch(nodeUids)) {
            const response = await this.apiService.post(`drive/v2/volumes/${volumeId}/trash_multiple`, {
                LinkIDs: batchNodeIds,
            }, signal);
            // TODO: remove `as` when backend fixes OpenAPI schema.
            yield* handleResponseErrors(batchNodeUids, volumeId, response.Responses);
        }
    }
    async emptyTrash(volumeId) {
        await this.apiService.delete(`drive/volumes/${volumeId}/trash`);
    }
    async *restoreNodes(nodeUids, signal) {
        for (const { volumeId, batchNodeIds, batchNodeUids } of groupNodeUidsByVolumeAndIteratePerBatch(nodeUids)) {
            const response = await this.apiService.put(`drive/v2/volumes/${volumeId}/trash/restore_multiple`, {
                LinkIDs: batchNodeIds,
            }, signal);
            // TODO: remove `as` when backend fixes OpenAPI schema.
            yield* handleResponseErrors(batchNodeUids, volumeId, response.Responses);
        }
    }
    async *deleteTrashedNodes(nodeUids, signal) {
        for (const { volumeId, batchNodeIds, batchNodeUids } of groupNodeUidsByVolumeAndIteratePerBatch(nodeUids)) {
            const response = await this.apiService.post(`drive/v2/volumes/${volumeId}/trash/delete_multiple`, {
                LinkIDs: batchNodeIds,
            }, signal);
            // TODO: remove `as` when backend fixes OpenAPI schema.
            yield* handleResponseErrors(batchNodeUids, volumeId, response.Responses);
        }
    }
    async *deleteMyNodes(nodeUids, signal) {
        for (const { volumeId, batchNodeIds, batchNodeUids } of groupNodeUidsByVolumeAndIteratePerBatch(nodeUids)) {
            const response = await this.apiService.post(`drive/v2/volumes/${volumeId}/remove-mine`, {
                LinkIDs: batchNodeIds,
            }, signal);
            // TODO: remove `as` when backend fixes OpenAPI schema.
            yield* handleResponseErrors(batchNodeUids, volumeId, response.Responses);
        }
    }
    async createFolder(parentUid, newNode) {
        const { volumeId, nodeId: parentId } = (0, uids_1.splitNodeUid)(parentUid);
        let response;
        try {
            response = await this.apiService.post(`drive/v2/volumes/${volumeId}/folders`, {
                ParentLinkID: parentId,
                NodeKey: newNode.armoredKey,
                NodeHashKey: newNode.armoredHashKey,
                NodePassphrase: newNode.armoredNodePassphrase,
                NodePassphraseSignature: newNode.armoredNodePassphraseSignature,
                SignatureEmail: newNode.signatureEmail,
                Name: newNode.encryptedName,
                Hash: newNode.hash,
                // @ts-expect-error: XAttr is optional as undefined.
                XAttr: newNode.armoredExtendedAttributes,
            });
        }
        catch (error) {
            handleNodeWithSameNameExistsValidationError(volumeId, error);
            throw error;
        }
        return (0, uids_1.makeNodeUid)(volumeId, response.Folder.ID);
    }
    async getRevision(nodeRevisionUid, signal) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(nodeRevisionUid);
        const response = await this.apiService.get(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions/${revisionId}?NoBlockUrls=true`, signal);
        return transformRevisionResponse(volumeId, nodeId, response.Revision);
    }
    async getRevisions(nodeUid, signal) {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const response = await this.apiService.get(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions`, signal);
        return response.Revisions.filter((revision) => revision.State === APIRevisionState.Active || revision.State === APIRevisionState.Obsolete).map((revision) => transformRevisionResponse(volumeId, nodeId, revision));
    }
    async restoreRevision(nodeRevisionUid) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(nodeRevisionUid);
        await this.apiService.post(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions/${revisionId}/restore`);
    }
    async deleteRevision(nodeRevisionUid) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(nodeRevisionUid);
        await this.apiService.delete(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions/${revisionId}`);
    }
    async checkAvailableHashes(parentNodeUid, hashes) {
        const { volumeId, nodeId: parentNodeId } = (0, uids_1.splitNodeUid)(parentNodeUid);
        const result = await this.apiService.post(`drive/v2/volumes/${volumeId}/links/${parentNodeId}/checkAvailableHashes`, {
            Hashes: hashes,
            ClientUID: this.clientUid ? [this.clientUid] : null,
        });
        return {
            availableHashes: result.AvailableHashes,
            pendingHashes: result.PendingHashes.map((hash) => ({
                hash: hash.Hash,
                nodeUid: (0, uids_1.makeNodeUid)(volumeId, hash.LinkID),
                revisionUid: (0, uids_1.makeNodeRevisionUid)(volumeId, hash.LinkID, hash.RevisionID),
                clientUid: hash.ClientUID || undefined,
            })),
        };
    }
}
exports.NodeAPIServiceBase = NodeAPIServiceBase;
class NodeAPIService extends NodeAPIServiceBase {
    constructor(logger, apiService, clientUid) {
        super(logger, apiService, clientUid);
    }
    async fetchNodeMetadata(volumeId, linkIds, signal) {
        const response = await this.apiService.post(`drive/v2/volumes/${volumeId}/links`, {
            LinkIDs: linkIds,
        }, signal);
        return response.Links;
    }
    linkToEncryptedNode(volumeId, link, isOwnVolumeId) {
        return linkToEncryptedNode(this.logger, volumeId, link, isOwnVolumeId);
    }
}
exports.NodeAPIService = NodeAPIService;
function* handleResponseErrors(nodeUids, volumeId, responses = []) {
    const errors = new Map();
    responses.forEach((response) => {
        if (!response.Response.Code || !(0, apiService_1.isCodeOk)(response.Response.Code) || response.Response.Error) {
            const nodeUid = (0, uids_1.makeNodeUid)(volumeId, response.LinkID);
            errors.set(nodeUid, response.Response.Error || (0, ttag_1.c)('Error').t `Unknown error ${response.Response.Code}`);
        }
    });
    for (const uid of nodeUids) {
        const error = errors.get(uid);
        if (error) {
            yield { uid, ok: false, error };
        }
        else {
            yield { uid, ok: true };
        }
    }
}
function handleNodeWithSameNameExistsValidationError(volumeId, error) {
    if (error instanceof errors_1.ValidationError) {
        if (error.code === 2500 /* ErrorCode.ALREADY_EXISTS */) {
            const typedDetails = error.details;
            const existingNodeUid = typedDetails?.ConflictLinkID
                ? (0, uids_1.makeNodeUid)(volumeId, typedDetails.ConflictLinkID)
                : undefined;
            throw new errors_1.NodeWithSameNameExistsValidationError(error.message, error.code, existingNodeUid);
        }
    }
}
function linkToEncryptedNode(logger, volumeId, link, isAdmin) {
    const { baseNodeMetadata, baseCryptoNodeMetadata } = linkToEncryptedNodeBaseMetadata(logger, volumeId, link, isAdmin);
    if (link.Link.Type === 1 && link.Folder) {
        return {
            ...baseNodeMetadata,
            encryptedCrypto: {
                ...baseCryptoNodeMetadata,
                folder: {
                    armoredExtendedAttributes: link.Folder.XAttr || undefined,
                    armoredHashKey: link.Folder.NodeHashKey,
                },
            },
        };
    }
    if (link.Link.Type === 2 && link.File && link.File.ActiveRevision) {
        return {
            ...baseNodeMetadata,
            totalStorageSize: link.File.TotalEncryptedSize,
            mediaType: link.File.MediaType || undefined,
            encryptedCrypto: {
                ...baseCryptoNodeMetadata,
                file: {
                    base64ContentKeyPacket: link.File.ContentKeyPacket,
                    armoredContentKeyPacketSignature: link.File.ContentKeyPacketSignature || undefined,
                },
                activeRevision: {
                    uid: (0, uids_1.makeNodeRevisionUid)(volumeId, link.Link.LinkID, link.File.ActiveRevision.RevisionID),
                    state: interface_1.RevisionState.Active,
                    creationTime: new Date(link.File.ActiveRevision.CreateTime * 1000),
                    storageSize: link.File.ActiveRevision.EncryptedSize,
                    signatureEmail: link.File.ActiveRevision.SignatureEmail || undefined,
                    armoredExtendedAttributes: link.File.ActiveRevision.XAttr || undefined,
                    thumbnails: link.File.ActiveRevision.Thumbnails?.map((thumbnail) => transformThumbnail(volumeId, link.Link.LinkID, thumbnail)) || [],
                },
            },
        };
    }
    // TODO: Remove this once client do not use main SDK for photos.
    // At the beginning, the client used main SDK for some photo actions.
    // This was a temporary solution before the Photos SDK was implemented.
    // Now the client must use Photos SDK for all photo-related actions.
    // Knowledge of albums in main SDK is deprecated and will be removed.
    if (link.Link.Type === 3) {
        return {
            ...baseNodeMetadata,
            encryptedCrypto: {
                ...baseCryptoNodeMetadata,
            },
        };
    }
    throw new Error(`Unknown node type: ${link.Link.Type}`);
}
function linkToEncryptedNodeBaseMetadata(logger, volumeId, link, isAdmin) {
    const membershipRole = (0, apiService_1.permissionsToMemberRole)(logger, link.Membership?.Permissions);
    const baseNodeMetadata = {
        // Internal metadata
        hash: link.Link.NameHash || undefined,
        encryptedName: link.Link.Name,
        // Basic node metadata
        uid: (0, uids_1.makeNodeUid)(volumeId, link.Link.LinkID),
        parentUid: link.Link.ParentLinkID ? (0, uids_1.makeNodeUid)(volumeId, link.Link.ParentLinkID) : undefined,
        type: (0, apiService_1.nodeTypeNumberToNodeType)(logger, link.Link.Type),
        creationTime: new Date(link.Link.CreateTime * 1000),
        modificationTime: new Date(link.Link.ModifyTime * 1000),
        trashTime: link.Link.TrashTime ? new Date(link.Link.TrashTime * 1000) : undefined,
        // Sharing node metadata
        shareId: link.Sharing?.ShareID || undefined,
        isShared: !!link.Sharing,
        isSharedPublicly: !!link.Sharing?.ShareURLID,
        directRole: isAdmin ? interface_1.MemberRole.Admin : membershipRole,
        membership: link.Membership
            ? {
                role: membershipRole,
                inviteTime: new Date(link.Membership.InviteTime * 1000),
            }
            : undefined,
    };
    const baseCryptoNodeMetadata = {
        signatureEmail: link.Link.SignatureEmail || undefined,
        nameSignatureEmail: link.Link.NameSignatureEmail || undefined,
        armoredKey: link.Link.NodeKey,
        armoredNodePassphrase: link.Link.NodePassphrase,
        armoredNodePassphraseSignature: link.Link.NodePassphraseSignature,
        membership: link.Membership
            ? {
                inviterEmail: link.Membership.InviterEmail,
                base64MemberSharePassphraseKeyPacket: link.Membership.MemberSharePassphraseKeyPacket,
                armoredInviterSharePassphraseKeyPacketSignature: link.Membership.InviterSharePassphraseKeyPacketSignature,
                armoredInviteeSharePassphraseSessionKeySignature: link.Membership.InviteeSharePassphraseSessionKeySignature,
            }
            : undefined,
    };
    return {
        baseNodeMetadata,
        baseCryptoNodeMetadata,
    };
}
function* groupNodeUidsByVolumeAndIteratePerBatch(nodeUids) {
    const allNodeIds = nodeUids.map((nodeUid) => {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
        return { volumeId, nodeIds: { nodeId, nodeUid } };
    });
    const nodeIdsByVolumeId = new Map();
    for (const { volumeId, nodeIds } of allNodeIds) {
        if (!nodeIdsByVolumeId.has(volumeId)) {
            nodeIdsByVolumeId.set(volumeId, []);
        }
        nodeIdsByVolumeId.get(volumeId)?.push(nodeIds);
    }
    for (const [volumeId, nodeIds] of nodeIdsByVolumeId.entries()) {
        for (const nodeIdsBatch of (0, batch_1.batch)(nodeIds, API_NODES_BATCH_SIZE)) {
            yield {
                volumeId,
                batchNodeIds: nodeIdsBatch.map(({ nodeId }) => nodeId),
                batchNodeUids: nodeIdsBatch.map(({ nodeUid }) => nodeUid),
            };
        }
    }
}
function transformRevisionResponse(volumeId, nodeId, revision) {
    return {
        uid: (0, uids_1.makeNodeRevisionUid)(volumeId, nodeId, revision.ID),
        state: revision.State === APIRevisionState.Active ? interface_1.RevisionState.Active : interface_1.RevisionState.Superseded,
        // @ts-expect-error: API doc is wrong, CreateTime is not optional.
        creationTime: new Date(revision.CreateTime * 1000),
        storageSize: revision.Size,
        signatureEmail: revision.SignatureEmail || undefined,
        armoredExtendedAttributes: revision.XAttr || undefined,
        thumbnails: revision.Thumbnails?.map((thumbnail) => transformThumbnail(volumeId, nodeId, thumbnail)) || [],
    };
}
function transformThumbnail(volumeId, nodeId, thumbnail) {
    return {
        // TODO: Legacy thumbnails didn't have ID but we don't have them anymore. Remove typing once API doc is updated.
        uid: (0, uids_1.makeNodeThumbnailUid)(volumeId, nodeId, thumbnail.ThumbnailID),
        // TODO: We don't support any other thumbnail type yet.
        type: thumbnail.Type,
    };
}
//# sourceMappingURL=apiService.js.map