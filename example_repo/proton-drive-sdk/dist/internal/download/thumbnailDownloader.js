"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThumbnailDownloader = void 0;
const ttag_1 = require("ttag");
const interface_1 = require("../../interface");
const errors_1 = require("../../errors");
const telemetry_1 = require("../../telemetry");
const errors_2 = require("../errors");
/**
 * Maximum number of thumbnails that can be downloaded at the same time.
 */
const MAX_DOWNLOAD_THUMBNAILS = 10;
/**
 * Maximum number of retries for thumbnail download and decryption.
 */
const MAX_THUMBNAIL_DOWNLOAD_ATTEMPTS = 2;
class ThumbnailDownloader {
    nodesService;
    apiService;
    cryptoService;
    logger;
    batchThumbnailToNodeUids = new Map();
    ongoingDownloads = new Map();
    bufferedThumbnails = [];
    constructor(telemetry, nodesService, apiService, cryptoService) {
        this.nodesService = nodesService;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.logger = telemetry.getLogger('download');
        this.nodesService = nodesService;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
    }
    async *iterateThumbnails(nodeUids, thumbnailType = interface_1.ThumbnailType.Type1, signal) {
        if (nodeUids.length === 0) {
            return;
        }
        for await (const result of this.iterateThumbnailUids(nodeUids, thumbnailType, signal)) {
            if (!result.ok) {
                yield result;
                continue;
            }
            this.batchThumbnailToNodeUids.set(result.thumbnailUid, result.nodeUid);
            if (this.batchThumbnailToNodeUids.size >= MAX_DOWNLOAD_THUMBNAILS) {
                await this.requestBatchedThumbnailDownloads(signal);
            }
            while (this.ongoingDownloads.size >= MAX_DOWNLOAD_THUMBNAILS) {
                await Promise.race(this.ongoingDownloads.values());
                yield* this.bufferedThumbnails;
                this.bufferedThumbnails = [];
            }
        }
        await this.requestBatchedThumbnailDownloads(signal);
        while (this.ongoingDownloads.size > 0) {
            await Promise.race(this.ongoingDownloads.values());
            yield* this.bufferedThumbnails;
            this.bufferedThumbnails = [];
        }
        yield* this.bufferedThumbnails;
        this.bufferedThumbnails = [];
    }
    async *iterateThumbnailUids(nodeUids, thumbnailType, signal) {
        for await (const node of this.nodesService.iterateNodes(nodeUids, signal)) {
            if ('missingUid' in node) {
                yield {
                    nodeUid: node.missingUid,
                    ok: false,
                    error: (0, ttag_1.c)('Error').t `Node not found`,
                };
                continue;
            }
            if (node.type !== interface_1.NodeType.File) {
                yield {
                    nodeUid: node.uid,
                    ok: false,
                    error: (0, ttag_1.c)('Error').t `Node is not a file`,
                };
                continue;
            }
            let thumbnail;
            if (node.activeRevision?.ok) {
                thumbnail = node.activeRevision.value.thumbnails?.find((t) => t.type === thumbnailType);
            }
            if (!thumbnail) {
                yield {
                    nodeUid: node.uid,
                    ok: false,
                    error: (0, ttag_1.c)('Error').t `Node has no thumbnail`,
                };
                continue;
            }
            yield {
                nodeUid: node.uid,
                ok: true,
                thumbnailUid: thumbnail.uid,
            };
        }
    }
    async requestBatchedThumbnailDownloads(signal) {
        if (this.batchThumbnailToNodeUids.size === 0) {
            return;
        }
        this.logger.debug(`Downloading thumbnail batch of size ${this.batchThumbnailToNodeUids.size}`);
        for await (const downloadResult of this.iterateThumbnailDownloads(signal)) {
            if (!downloadResult.ok) {
                this.bufferedThumbnails.push({
                    nodeUid: downloadResult.nodeUid,
                    ok: false,
                    error: downloadResult.error,
                });
                continue;
            }
            this.ongoingDownloads.set(downloadResult.nodeUid, downloadResult.downloadPromise
                .then((thumbnail) => {
                this.bufferedThumbnails.push({
                    nodeUid: downloadResult.nodeUid,
                    ok: true,
                    thumbnail,
                });
            })
                .catch((error) => {
                this.bufferedThumbnails.push({
                    nodeUid: downloadResult.nodeUid,
                    ok: false,
                    error: (0, errors_2.getErrorMessage)(error),
                });
            })
                .finally(() => {
                this.ongoingDownloads.delete(downloadResult.nodeUid);
            }));
        }
        this.batchThumbnailToNodeUids.clear();
    }
    async *iterateThumbnailDownloads(signal) {
        const missingThumbnailUids = new Set(this.batchThumbnailToNodeUids.keys());
        for await (const result of this.apiService.iterateThumbnails(Array.from(this.batchThumbnailToNodeUids.keys()), signal)) {
            const nodeUid = this.batchThumbnailToNodeUids.get(result.uid);
            if (!nodeUid) {
                this.logger.warn(`Unexpected thumbnail UID ${result.uid} returned from API`);
                continue;
            }
            missingThumbnailUids.delete(result.uid);
            if (!result.ok) {
                yield {
                    nodeUid,
                    ok: false,
                    error: result.error,
                };
                continue;
            }
            yield {
                nodeUid,
                ok: true,
                downloadPromise: this.downloadThumbnail(nodeUid, result.bareUrl, result.token, signal),
            };
        }
        for (const uid of missingThumbnailUids) {
            const nodeUid = this.batchThumbnailToNodeUids.get(uid);
            this.logger.warn(`Thumbnail UID ${uid} not found in API response`);
            yield {
                nodeUid,
                ok: false,
                error: (0, ttag_1.c)('Error').t `Thumbnail not found`,
            };
        }
    }
    async downloadThumbnail(nodeUid, bareUrl, token, signal) {
        const logger = new telemetry_1.LoggerWithPrefix(this.logger, `thumbnail ${token}`);
        let decryptedBlock = null;
        let attempt = 0;
        while (!decryptedBlock) {
            logger.debug(`Downloading`);
            attempt++;
            try {
                const [nodeKeys, encryptedBlock] = await Promise.all([
                    this.nodesService.getNodeKeys(nodeUid),
                    this.apiService.downloadBlock(bareUrl, token, undefined, signal),
                ]);
                if (!nodeKeys.contentKeyPacketSessionKey) {
                    throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `File has no content key`);
                }
                logger.debug(`Decrypting`);
                decryptedBlock = await this.cryptoService.decryptThumbnail(encryptedBlock, nodeKeys.contentKeyPacketSessionKey);
            }
            catch (error) {
                if (attempt <= MAX_THUMBNAIL_DOWNLOAD_ATTEMPTS) {
                    logger.warn(`Thumbnail download failed #${attempt}, retrying: ${(0, errors_2.getErrorMessage)(error)}`);
                    continue;
                }
                logger.error(`Thumbnail download failed`, error);
                throw error;
            }
        }
        return decryptedBlock;
    }
}
exports.ThumbnailDownloader = ThumbnailDownloader;
//# sourceMappingURL=thumbnailDownloader.js.map