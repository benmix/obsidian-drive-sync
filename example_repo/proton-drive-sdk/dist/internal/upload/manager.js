"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadManager = void 0;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
const nodes_1 = require("../nodes");
const uids_1 = require("../uids");
/**
 * UploadManager is responsible for creating and deleting draft nodes
 * on the server. It handles the creation of draft nodes, including
 * generating the necessary cryptographic keys and metadata.
 */
class UploadManager {
    apiService;
    cryptoService;
    nodesService;
    clientUid;
    logger;
    constructor(telemetry, apiService, cryptoService, nodesService, clientUid) {
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.nodesService = nodesService;
        this.clientUid = clientUid;
        this.logger = telemetry.getLogger('upload');
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.nodesService = nodesService;
        this.clientUid = clientUid;
    }
    async createDraftNode(parentFolderUid, name, metadata) {
        const parentKeys = await this.nodesService.getNodeKeys(parentFolderUid);
        if (!parentKeys.hashKey) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Creating files in non-folders is not allowed`);
        }
        const generatedNodeCrypto = await this.cryptoService.generateFileCrypto(parentFolderUid, { key: parentKeys.key, hashKey: parentKeys.hashKey }, name);
        const { nodeUid, nodeRevisionUid } = await this.createDraftOnAPI(parentFolderUid, parentKeys.hashKey, name, metadata, generatedNodeCrypto);
        return {
            nodeUid,
            nodeRevisionUid,
            nodeKeys: {
                key: generatedNodeCrypto.nodeKeys.decrypted.key,
                contentKeyPacketSessionKey: generatedNodeCrypto.contentKey.decrypted.contentKeyPacketSessionKey,
                signingKeys: generatedNodeCrypto.signingKeys,
            },
            parentNodeKeys: {
                hashKey: parentKeys.hashKey,
            },
            newNodeInfo: {
                parentUid: parentFolderUid,
                name,
                encryptedName: generatedNodeCrypto.encryptedNode.encryptedName,
                hash: generatedNodeCrypto.encryptedNode.hash,
            },
        };
    }
    async createDraftOnAPI(parentFolderUid, parentHashKey, name, metadata, generatedNodeCrypto) {
        try {
            const result = await this.apiService.createDraft(parentFolderUid, {
                armoredEncryptedName: generatedNodeCrypto.encryptedNode.encryptedName,
                hash: generatedNodeCrypto.encryptedNode.hash,
                mediaType: metadata.mediaType,
                intendedUploadSize: metadata.expectedSize,
                armoredNodeKey: generatedNodeCrypto.nodeKeys.encrypted.armoredKey,
                armoredNodePassphrase: generatedNodeCrypto.nodeKeys.encrypted.armoredPassphrase,
                armoredNodePassphraseSignature: generatedNodeCrypto.nodeKeys.encrypted.armoredPassphraseSignature,
                base64ContentKeyPacket: generatedNodeCrypto.contentKey.encrypted.base64ContentKeyPacket,
                armoredContentKeyPacketSignature: generatedNodeCrypto.contentKey.encrypted.armoredContentKeyPacketSignature,
                signatureEmail: generatedNodeCrypto.signingKeys.email,
            });
            return result;
        }
        catch (error) {
            if (error instanceof errors_1.ValidationError) {
                if (error.code === 2500 /* ErrorCode.ALREADY_EXISTS */) {
                    this.logger.info(`Node with given name already exists`);
                    const typedDetails = error.details;
                    // If the client doesn't specify the client UID, it should
                    // never be considered own draft.
                    const isOwnDraftConflict = typedDetails?.ConflictDraftRevisionID &&
                        this.clientUid &&
                        typedDetails?.ConflictDraftClientUID === this.clientUid;
                    // If there is existing draft created by this client,
                    // automatically delete it and try to create a new one
                    // with the same name again.
                    if (typedDetails?.ConflictDraftRevisionID &&
                        (isOwnDraftConflict || metadata.overrideExistingDraftByOtherClient)) {
                        const existingDraftNodeUid = (0, uids_1.makeNodeUid)((0, uids_1.splitNodeUid)(parentFolderUid).volumeId, typedDetails.ConflictLinkID);
                        let deleteFailed = false;
                        try {
                            this.logger.warn(`Deleting existing draft node ${existingDraftNodeUid} by ${typedDetails.ConflictDraftClientUID}`);
                            await this.apiService.deleteDraft(existingDraftNodeUid);
                        }
                        catch (deleteDraftError) {
                            // Do not throw, let throw the conflict error.
                            deleteFailed = true;
                            this.logger.error('Failed to delete existing draft node', deleteDraftError);
                        }
                        if (!deleteFailed) {
                            return this.createDraftOnAPI(parentFolderUid, parentHashKey, name, metadata, generatedNodeCrypto);
                        }
                    }
                    if (isOwnDraftConflict) {
                        this.logger.warn(`Existing draft conflict by another client ${typedDetails.ConflictDraftClientUID}`);
                    }
                    const existingNodeUid = typedDetails
                        ? (0, uids_1.makeNodeUid)((0, uids_1.splitNodeUid)(parentFolderUid).volumeId, typedDetails.ConflictLinkID)
                        : undefined;
                    throw new errors_1.NodeWithSameNameExistsValidationError(error.message, error.code, existingNodeUid, !!typedDetails?.ConflictDraftRevisionID);
                }
            }
            throw error;
        }
    }
    async deleteDraftNode(nodeUid) {
        try {
            await this.apiService.deleteDraft(nodeUid);
        }
        catch (error) {
            // Only log the error but do not fail the operation as we are
            // deleting draft only when somethign fails and original error
            // will bubble up.
            this.logger.error('Failed to delete draft node', error);
        }
    }
    async createDraftRevision(nodeUid, metadata) {
        const node = await this.nodesService.getNode(nodeUid);
        const nodeKeys = await this.nodesService.getNodeKeys(nodeUid);
        if (!node.activeRevision?.ok || !nodeKeys.contentKeyPacketSessionKey) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Creating revisions in non-files is not allowed`);
        }
        const signingKeys = await this.cryptoService.getSigningKeysForExistingNode({
            nodeUid,
            parentNodeUid: node.parentUid,
        });
        const { nodeRevisionUid } = await this.apiService.createDraftRevision(nodeUid, {
            currentRevisionUid: node.activeRevision.value.uid,
            intendedUploadSize: metadata.expectedSize,
        });
        return {
            nodeUid,
            nodeRevisionUid,
            nodeKeys: {
                key: nodeKeys.key,
                contentKeyPacketSessionKey: nodeKeys.contentKeyPacketSessionKey,
                signingKeys,
            },
        };
    }
    async deleteDraftRevision(nodeRevisionUid) {
        try {
            await this.apiService.deleteDraftRevision(nodeRevisionUid);
        }
        catch (error) {
            // Only log the error but do not fail the operation as we are
            // deleting draft only when somethign fails and original error
            // will bubble up.
            this.logger.error('Failed to delete draft node revision', error);
        }
    }
    async commitDraft(nodeRevisionDraft, manifest, extendedAttributes, additionalExtendedAttributes) {
        const generatedExtendedAttributes = (0, nodes_1.generateFileExtendedAttributes)(extendedAttributes, additionalExtendedAttributes);
        const nodeCommitCrypto = await this.cryptoService.commitFile(nodeRevisionDraft.nodeKeys, manifest, generatedExtendedAttributes);
        try {
            await this.apiService.commitDraftRevision(nodeRevisionDraft.nodeRevisionUid, nodeCommitCrypto);
        }
        catch (error) {
            // Commit might be sent but due to network error no response is
            // received. In this case, API service automatically retries the
            // request. If the first attempt passed, it will fail on the second
            // attempt. We need to check if the revision was actually committed.
            try {
                const isRevisionUploaded = await this.apiService.isRevisionUploaded(nodeRevisionDraft.nodeRevisionUid);
                if (!isRevisionUploaded) {
                    throw error;
                }
            }
            catch {
                throw error; // Throw original error, not the checking one.
            }
            this.logger.warn(`Node commit failed but node was committed successfully ${nodeRevisionDraft.nodeUid}`);
        }
        await this.notifyNodeUploaded(nodeRevisionDraft);
    }
    async notifyNodeUploaded(nodeRevisionDraft) {
        // If new revision to existing node was created, invalidate the node.
        // Otherwise notify about the new child in the parent.
        if (nodeRevisionDraft.newNodeInfo) {
            await this.nodesService.notifyChildCreated(nodeRevisionDraft.newNodeInfo.parentUid);
        }
        else {
            await this.nodesService.notifyNodeChanged(nodeRevisionDraft.nodeUid);
        }
    }
}
exports.UploadManager = UploadManager;
//# sourceMappingURL=manager.js.map