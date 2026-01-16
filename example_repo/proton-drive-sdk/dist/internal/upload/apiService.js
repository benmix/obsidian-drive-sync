"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadAPIService = void 0;
const ttag_1 = require("ttag");
const crypto_1 = require("../../crypto");
const apiService_1 = require("../apiService");
const uids_1 = require("../uids");
class UploadAPIService {
    apiService;
    clientUid;
    constructor(apiService, clientUid) {
        this.apiService = apiService;
        this.clientUid = clientUid;
        this.apiService = apiService;
        this.clientUid = clientUid;
    }
    async createDraft(parentNodeUid, node) {
        // The client shouldn't send the clear text size of the file.
        // The intented upload size is needed only for early validation that
        // the file can fit in the remaining quota to avoid data transfer when
        // the upload would be rejected. The backend will still validate
        // the quota during block upload and revision commit.
        const precision = 100_000; // bytes
        const intendedUploadSize = node.intendedUploadSize && node.intendedUploadSize > precision
            ? Math.floor(node.intendedUploadSize / precision) * precision
            : null;
        const { volumeId, nodeId: parentNodeId } = (0, uids_1.splitNodeUid)(parentNodeUid);
        const result = await this.apiService.post(`drive/v2/volumes/${volumeId}/files`, {
            ParentLinkID: parentNodeId,
            Name: node.armoredEncryptedName,
            Hash: node.hash,
            MIMEType: node.mediaType,
            ClientUID: this.clientUid || null,
            IntendedUploadSize: intendedUploadSize,
            NodeKey: node.armoredNodeKey,
            NodePassphrase: node.armoredNodePassphrase,
            NodePassphraseSignature: node.armoredNodePassphraseSignature,
            ContentKeyPacket: node.base64ContentKeyPacket,
            ContentKeyPacketSignature: node.armoredContentKeyPacketSignature,
            SignatureAddress: node.signatureEmail,
        });
        return {
            nodeUid: (0, uids_1.makeNodeUid)(volumeId, result.File.ID),
            nodeRevisionUid: (0, uids_1.makeNodeRevisionUid)(volumeId, result.File.ID, result.File.RevisionID),
        };
    }
    async createDraftRevision(nodeUid, revision) {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const { revisionId: currentRevisionId } = (0, uids_1.splitNodeRevisionUid)(revision.currentRevisionUid);
        const result = await this.apiService.post(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions`, {
            CurrentRevisionID: currentRevisionId,
            ClientUID: this.clientUid || null,
            IntendedUploadSize: revision.intendedUploadSize || null,
        });
        return {
            nodeRevisionUid: (0, uids_1.makeNodeRevisionUid)(volumeId, nodeId, result.Revision.ID),
        };
    }
    async getVerificationData(draftNodeRevisionUid) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(draftNodeRevisionUid);
        const result = await this.apiService.get(`drive/v2/volumes/${volumeId}/links/${nodeId}/revisions/${revisionId}/verification`);
        return {
            verificationCode: (0, crypto_1.base64StringToUint8Array)(result.VerificationCode),
            base64ContentKeyPacket: result.ContentKeyPacket,
        };
    }
    async requestBlockUpload(draftNodeRevisionUid, addressId, blocks) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(draftNodeRevisionUid);
        const result = await this.apiService.post('drive/blocks', {
            AddressID: addressId,
            VolumeID: volumeId,
            LinkID: nodeId,
            RevisionID: revisionId,
            BlockList: blocks.contentBlocks.map((block) => ({
                Index: block.index,
                Hash: (0, crypto_1.uint8ArrayToBase64String)(block.hash),
                EncSignature: block.armoredSignature,
                Size: block.encryptedSize,
                Verifier: {
                    Token: (0, crypto_1.uint8ArrayToBase64String)(block.verificationToken),
                },
            })),
            ThumbnailList: (blocks.thumbnails || []).map((block) => ({
                Hash: (0, crypto_1.uint8ArrayToBase64String)(block.hash),
                Size: block.encryptedSize,
                Type: block.type,
            })),
        });
        return {
            blockTokens: result.UploadLinks.map((link) => ({
                index: link.Index,
                bareUrl: link.BareURL,
                token: link.Token,
            })),
            thumbnailTokens: (result.ThumbnailLinks || []).map((link) => ({
                // We can type as ThumbnailType because we are passing the type in the request.
                type: link.ThumbnailType,
                bareUrl: link.BareURL,
                token: link.Token,
            })),
        };
    }
    async commitDraftRevision(draftNodeRevisionUid, options) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(draftNodeRevisionUid);
        await this.apiService.put(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions/${revisionId}`, {
            ManifestSignature: options.armoredManifestSignature,
            SignatureAddress: options.signatureEmail,
            XAttr: options.armoredExtendedAttributes || null,
            Photo: null, // Only used for photos in the Photo volume.
        });
    }
    async deleteDraft(draftNodeUid) {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(draftNodeUid);
        const response = await this.apiService.post(`drive/v2/volumes/${volumeId}/delete_multiple`, {
            LinkIDs: [nodeId],
        });
        const code = response.Responses?.[0].Response.Code || 0;
        if (!(0, apiService_1.isCodeOk)(code)) {
            throw new apiService_1.APICodeError((0, ttag_1.c)('Error').t `Unknown error ${code}`, code);
        }
    }
    async deleteDraftRevision(draftNodeRevisionUid) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(draftNodeRevisionUid);
        await this.apiService.delete(`/drive/v2/volumes/${volumeId}/files/${nodeId}/revisions/${revisionId}`);
    }
    async uploadBlock(url, token, block, onProgress, signal) {
        const formData = new FormData();
        formData.append('Block', new Blob([block]), 'blob');
        await this.apiService.postBlockStream(url, token, formData, onProgress, signal);
    }
    async isRevisionUploaded(nodeRevisionUid) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(nodeRevisionUid);
        const result = await this.apiService.post(`drive/v2/volumes/${volumeId}/links`, {
            LinkIDs: [nodeId],
        });
        if (result.Links.length === 0) {
            return false;
        }
        const link = result.Links[0];
        return (link.Link.State === 1 && // ACTIVE state
            link.File?.ActiveRevision?.RevisionID === revisionId);
    }
}
exports.UploadAPIService = UploadAPIService;
//# sourceMappingURL=apiService.js.map