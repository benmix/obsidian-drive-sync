"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadAPIService = void 0;
const apiService_1 = require("../apiService");
const uids_1 = require("../uids");
const BLOCKS_PAGE_SIZE = 20;
class DownloadAPIService {
    apiService;
    constructor(apiService) {
        this.apiService = apiService;
        this.apiService = apiService;
    }
    async *iterateRevisionBlocks(nodeRevisionUid, signal, fromBlockIndex = 1) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(nodeRevisionUid);
        while (true) {
            if (signal?.aborted) {
                break;
            }
            const result = await this.apiService.get(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions/${revisionId}?PageSize=${BLOCKS_PAGE_SIZE}&FromBlockIndex=${fromBlockIndex}`, signal);
            if (fromBlockIndex === 1) {
                yield {
                    type: 'manifestSignature',
                    armoredManifestSignature: result.Revision.ManifestSignature || undefined,
                };
                if (result.Revision.Thumbnails.length > 0) {
                    for (const block of result.Revision.Thumbnails) {
                        yield {
                            type: 'thumbnail',
                            base64sha256Hash: block.Hash,
                        };
                    }
                }
            }
            if (result.Revision.Blocks.length === 0) {
                break;
            }
            for (const block of result.Revision.Blocks) {
                yield {
                    type: 'block',
                    ...transformBlock(block),
                };
                fromBlockIndex = block.Index + 1;
            }
        }
    }
    async getRevisionBlockToken(nodeRevisionUid, blockIndex, signal) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(nodeRevisionUid);
        const result = await this.apiService.get(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions/${revisionId}?PageSize=1&FromBlockIndex=${blockIndex}`, signal);
        const block = result.Revision.Blocks[0];
        return transformBlock(block);
    }
    async downloadBlock(baseUrl, token, onProgress, signal) {
        const rawBlockStream = await this.apiService.getBlockStream(baseUrl, token, signal);
        const progressStream = new apiService_1.ObserverStream((value) => {
            onProgress?.(value.length);
        });
        const blockStream = rawBlockStream.pipeThrough(progressStream);
        const encryptedBlock = new Uint8Array(await new Response(blockStream).arrayBuffer());
        return encryptedBlock;
    }
    async *iterateThumbnails(thumbnailUids, signal) {
        const splitedThumbnailsIds = thumbnailUids.map(uids_1.splitNodeThumbnailUid);
        const thumbnailIdsByVolumeId = new Map();
        for (const { volumeId, thumbnailId, nodeId } of splitedThumbnailsIds) {
            if (!thumbnailIdsByVolumeId.has(volumeId)) {
                thumbnailIdsByVolumeId.set(volumeId, []);
            }
            thumbnailIdsByVolumeId.get(volumeId)?.push({ volumeId, thumbnailId, nodeId });
        }
        for (const [volumeId, thumbnailIds] of thumbnailIdsByVolumeId.entries()) {
            const result = await this.apiService.post(`drive/volumes/${volumeId}/thumbnails`, {
                ThumbnailIDs: thumbnailIds.map(({ thumbnailId }) => thumbnailId),
            }, signal);
            for (const thumbnail of result.Thumbnails) {
                const id = thumbnailIds.find(({ thumbnailId }) => thumbnailId === thumbnail.ThumbnailID);
                if (!id) {
                    continue;
                }
                yield {
                    uid: (0, uids_1.makeNodeThumbnailUid)(id.volumeId, id.nodeId, thumbnail.ThumbnailID),
                    ok: true,
                    bareUrl: thumbnail.BareURL,
                    token: thumbnail.Token,
                };
            }
            for (const error of result.Errors) {
                const id = thumbnailIds.find(({ thumbnailId }) => thumbnailId === error.ThumbnailID);
                if (!id) {
                    continue;
                }
                yield {
                    uid: (0, uids_1.makeNodeThumbnailUid)(id.volumeId, id.nodeId, error.ThumbnailID),
                    ok: false,
                    error: error.Error,
                };
            }
        }
    }
}
exports.DownloadAPIService = DownloadAPIService;
function transformBlock(block) {
    return {
        index: block.Index,
        bareUrl: block.BareURL,
        token: block.Token,
        base64sha256Hash: block.Hash,
        signatureEmail: block.SignatureEmail || undefined,
    };
}
//# sourceMappingURL=apiService.js.map