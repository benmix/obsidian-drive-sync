"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamUploader = exports.FILE_CHUNK_SIZE = void 0;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
const telemetry_1 = require("../../telemetry");
const apiService_1 = require("../apiService");
const errors_2 = require("../errors");
const utils_1 = require("../utils");
const wait_1 = require("../wait");
const digests_1 = require("./digests");
const chunkStreamReader_1 = require("./chunkStreamReader");
/**
 * File chunk size in bytes representing the size of each block.
 */
exports.FILE_CHUNK_SIZE = 4 * 1024 * 1024;
/**
 * Maximum number of blocks that can be buffered before upload.
 * This is to prevent using too much memory.
 */
const MAX_BUFFERED_BLOCKS = 15;
/**
 * Maximum number of blocks that can be uploaded at the same time.
 * This is to prevent overloading the server with too many requests.
 */
const MAX_UPLOADING_BLOCKS = 5;
/**
 * Maximum number of retries for block encryption.
 * This is to automatically retry random errors that can happen
 * during encryption, for example bitflips.
 */
const MAX_BLOCK_ENCRYPTION_RETRIES = 1;
/**
 * Maximum number of retries for block upload.
 * This is to ensure we don't end up in an infinite loop.
 */
const MAX_BLOCK_UPLOAD_RETRIES = 3;
/**
 * StreamUploader is responsible for uploading file content to the server.
 *
 * It handles the encryption of file blocks and thumbnails, as well as
 * the upload process itself. It manages the upload queue and ensures
 * that the upload process is efficient and does not overload the server.
 */
class StreamUploader {
    telemetry;
    apiService;
    cryptoService;
    uploadManager;
    blockVerifier;
    revisionDraft;
    metadata;
    onFinish;
    uploadController;
    abortController;
    maxUploadingBlocks = MAX_UPLOADING_BLOCKS;
    logger;
    digests;
    controller;
    encryptedThumbnails = new Map();
    encryptedBlocks = new Map();
    encryptionFinished = false;
    ongoingUploads = new Map();
    uploadedThumbnails = [];
    uploadedBlocks = [];
    // Error of the whole upload - either encryption or upload error.
    error;
    constructor(telemetry, apiService, cryptoService, uploadManager, blockVerifier, revisionDraft, metadata, onFinish, uploadController, abortController) {
        this.telemetry = telemetry;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.uploadManager = uploadManager;
        this.blockVerifier = blockVerifier;
        this.revisionDraft = revisionDraft;
        this.metadata = metadata;
        this.onFinish = onFinish;
        this.uploadController = uploadController;
        this.abortController = abortController;
        this.telemetry = telemetry;
        this.logger = telemetry.getLoggerForRevision(revisionDraft.nodeRevisionUid);
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.blockVerifier = blockVerifier;
        this.revisionDraft = revisionDraft;
        this.metadata = metadata;
        this.onFinish = onFinish;
        this.digests = new digests_1.UploadDigests();
        this.controller = uploadController;
        this.abortController = abortController;
    }
    async start(stream, thumbnails, onProgress) {
        let failure = false;
        // File progress is tracked for telemetry - to track at what
        // point the download failed.
        let fileProgress = 0;
        try {
            this.logger.info(`Starting upload`);
            await this.encryptAndUploadBlocks(stream, thumbnails, (uploadedBytes) => {
                fileProgress += uploadedBytes;
                onProgress?.(fileProgress);
            });
            this.logger.debug(`All blocks uploaded, committing`);
            await this.commitFile(thumbnails);
            void this.telemetry.uploadFinished(this.revisionDraft.nodeRevisionUid, fileProgress);
            this.logger.info(`Upload succeeded`);
        }
        catch (error) {
            failure = true;
            this.logger.error(`Upload failed`, error);
            void this.telemetry.uploadFailed(this.revisionDraft.nodeRevisionUid, error, fileProgress, this.metadata.expectedSize);
            throw error;
        }
        finally {
            this.logger.debug(`Upload cleanup`);
            // Help the garbage collector to clean up the memory.
            this.encryptedBlocks.clear();
            this.encryptedThumbnails.clear();
            this.ongoingUploads.clear();
            this.uploadedBlocks = [];
            this.uploadedThumbnails = [];
            this.encryptionFinished = false;
            await this.onFinish(failure);
        }
        return {
            nodeRevisionUid: this.revisionDraft.nodeRevisionUid,
            nodeUid: this.revisionDraft.nodeUid,
        };
    }
    async encryptAndUploadBlocks(stream, thumbnails, onProgress) {
        // We await for the encryption of thumbnails to finish before
        // starting the upload. This is because we need to request the
        // upload tokens for the thumbnails with the first blocks.
        await this.encryptThumbnails(thumbnails);
        // Encrypting blocks and uploading them is done in parallel.
        // For that reason, we want to await for the encryption later.
        // However, jest complains if encryptBlock rejects asynchronously.
        // For that reason we handle manually to save error to the variable
        // and throw if set after we await for the encryption.
        let encryptionError;
        const encryptBlocksPromise = this.encryptBlocks(stream).catch((error) => {
            encryptionError = error;
            void this.abortUpload(error);
        });
        while (!this.isUploadAborted) {
            await this.controller.waitWhilePaused();
            await this.waitForUploadCapacityAndBufferedBlocks();
            if (this.isEncryptionFullyFinished || this.isUploadAborted) {
                break;
            }
            await this.requestAndInitiateUpload(onProgress);
            if (this.isEncryptionFullyFinished) {
                break;
            }
        }
        // If the upload was aborted due to encryption or upload error, throw
        // the original error (it is failing upload).
        // If the upload was aborted due to abort signal, throw AbortError
        // (it is aborted by the user).
        if (this.error) {
            throw this.error;
        }
        if (this.abortController.signal.aborted) {
            throw new errors_1.AbortError();
        }
        this.logger.debug(`All blocks uploading, waiting for them to finish`);
        // Technically this is finished as while-block above will break
        // when encryption is finished. But in case of error there could
        // be a race condition that would cause the encryptionError to
        // not be set yet.
        await encryptBlocksPromise;
        if (encryptionError) {
            throw encryptionError;
        }
        await Promise.all(this.ongoingUploads.values().map(({ uploadPromise }) => uploadPromise));
    }
    async commitFile(thumbnails) {
        this.verifyIntegrity(thumbnails);
        const extendedAttributes = {
            modificationTime: this.metadata.modificationTime,
            size: this.metadata.expectedSize,
            blockSizes: this.uploadedBlockSizes,
            digests: this.digests.digests(),
        };
        await this.uploadManager.commitDraft(this.revisionDraft, this.manifest, extendedAttributes, this.metadata.additionalMetadata);
    }
    async encryptThumbnails(thumbnails) {
        if (new Set(thumbnails.map(({ type }) => type)).size !== thumbnails.length) {
            throw new Error(`Duplicate thumbnail types`);
        }
        for (const thumbnail of thumbnails) {
            if (this.isUploadAborted) {
                break;
            }
            this.logger.debug(`Encrypting thumbnail ${thumbnail.type}`);
            const encryptedThumbnail = await this.cryptoService.encryptThumbnail(this.revisionDraft.nodeKeys, thumbnail);
            this.encryptedThumbnails.set(thumbnail.type, encryptedThumbnail);
        }
    }
    async encryptBlocks(stream) {
        try {
            let index = 0;
            const reader = new chunkStreamReader_1.ChunkStreamReader(stream, exports.FILE_CHUNK_SIZE);
            for await (const block of reader.iterateChunks()) {
                index++;
                this.digests.update(block);
                await this.controller.waitWhilePaused();
                await this.waitForBufferCapacity();
                if (this.isUploadAborted) {
                    break;
                }
                this.logger.debug(`Encrypting block ${index}`);
                let attempt = 0;
                let integrityError = false;
                let encryptedBlock;
                while (!encryptedBlock) {
                    attempt++;
                    try {
                        encryptedBlock = await this.cryptoService.encryptBlock((encryptedBlock) => this.blockVerifier.verifyBlock(encryptedBlock), this.revisionDraft.nodeKeys, block, index);
                        if (integrityError) {
                            void this.telemetry.logBlockVerificationError(true);
                        }
                    }
                    catch (error) {
                        // Do not retry or report anything if the upload was aborted.
                        if (error instanceof errors_1.AbortError) {
                            throw error;
                        }
                        if (error instanceof errors_1.IntegrityError) {
                            integrityError = true;
                        }
                        if (attempt <= MAX_BLOCK_ENCRYPTION_RETRIES) {
                            this.logger.warn(`Block encryption failed #${attempt}, retrying: ${(0, errors_2.getErrorMessage)(error)}`);
                            continue;
                        }
                        this.logger.error(`Failed to encrypt block ${index}`, error);
                        if (integrityError) {
                            void this.telemetry.logBlockVerificationError(false);
                        }
                        throw error;
                    }
                }
                this.encryptedBlocks.set(index, encryptedBlock);
            }
        }
        finally {
            this.encryptionFinished = true;
        }
    }
    async requestAndInitiateUpload(onProgress) {
        this.logger.info(`Requesting upload tokens for ${this.encryptedBlocks.size} blocks`);
        const uploadTokens = await this.apiService.requestBlockUpload(this.revisionDraft.nodeRevisionUid, this.revisionDraft.nodeKeys.signingKeys.addressId, {
            contentBlocks: Array.from(this.encryptedBlocks.values().map((block) => ({
                index: block.index,
                encryptedSize: block.encryptedSize,
                hash: block.hash,
                armoredSignature: block.armoredSignature,
                verificationToken: block.verificationToken,
            }))),
            thumbnails: Array.from(this.encryptedThumbnails.values().map((block) => ({
                type: block.type,
                encryptedSize: block.encryptedSize,
                hash: block.hash,
            }))),
        });
        // If the upload was aborted while requesting next upload tokens,
        // do not schedule any next upload.
        if (this.isUploadAborted) {
            throw this.error || new errors_1.AbortError();
        }
        for (const thumbnailToken of uploadTokens.thumbnailTokens) {
            let encryptedThumbnail = this.encryptedThumbnails.get(thumbnailToken.type);
            if (!encryptedThumbnail) {
                throw new Error(`Thumbnail ${thumbnailToken.type} not found`);
            }
            this.encryptedThumbnails.delete(thumbnailToken.type);
            const uploadKey = `thumbnail:${thumbnailToken.type}`;
            this.ongoingUploads.set(uploadKey, {
                uploadPromise: this.uploadThumbnail(thumbnailToken, encryptedThumbnail, onProgress).finally(() => {
                    this.ongoingUploads.delete(uploadKey);
                    // Help the garbage collector to clean up the memory.
                    encryptedThumbnail = undefined;
                }),
                encryptedBlock: encryptedThumbnail,
            });
        }
        for (const blockToken of uploadTokens.blockTokens) {
            let encryptedBlock = this.encryptedBlocks.get(blockToken.index);
            if (!encryptedBlock) {
                throw new Error(`Block ${blockToken.index} not found`);
            }
            this.encryptedBlocks.delete(blockToken.index);
            const uploadKey = `block:${blockToken.index}`;
            this.ongoingUploads.set(uploadKey, {
                index: blockToken.index,
                uploadPromise: this.uploadBlock(blockToken, encryptedBlock, onProgress).finally(() => {
                    this.ongoingUploads.delete(uploadKey);
                    // Help the garbage collector to clean up the memory.
                    encryptedBlock = undefined;
                }),
                encryptedBlock,
            });
        }
    }
    async uploadThumbnail(uploadToken, encryptedThumbnail, onProgress) {
        const logger = new telemetry_1.LoggerWithPrefix(this.logger, `thumbnail type ${encryptedThumbnail.type} to ${uploadToken.token}`);
        logger.info(`Upload started`);
        let blockProgress = 0;
        let attempt = 0;
        while (true) {
            attempt++;
            try {
                logger.debug(`Uploading`);
                await this.apiService.uploadBlock(uploadToken.bareUrl, uploadToken.token, encryptedThumbnail.encryptedData, (uploadedBytes) => {
                    blockProgress += uploadedBytes;
                    onProgress?.(uploadedBytes);
                }, this.abortController.signal);
                this.uploadedThumbnails.push({
                    type: encryptedThumbnail.type,
                    hash: encryptedThumbnail.hash,
                    encryptedSize: encryptedThumbnail.encryptedSize,
                    originalSize: encryptedThumbnail.originalSize,
                });
                break;
            }
            catch (error) {
                // Do not retry or report anything if the upload was aborted.
                if (error instanceof errors_1.AbortError || this.isUploadAborted) {
                    throw error;
                }
                if (blockProgress !== 0) {
                    onProgress?.(-blockProgress);
                    blockProgress = 0;
                }
                // Note: We don't handle token expiration for thumbnails, because
                // the API requires the thumbnails to be requested with the first
                // upload block request. Thumbnails are tiny, so this edge case
                // should be very rare and considering it is the beginning of the
                // upload, the whole retry is cheap.
                // Upload can fail for various reasons, for example integrity
                // can fail due to bitflips. We want to retry and solve the issue
                // seamlessly for the user. We retry only once, because we don't
                // want to get stuck in a loop.
                if (attempt <= MAX_BLOCK_UPLOAD_RETRIES) {
                    logger.warn(`Upload failed #${attempt}, retrying: ${(0, errors_2.getErrorMessage)(error)}`);
                    continue;
                }
                logger.error(`Upload failed`, error);
                await this.abortUpload(error);
                throw error;
            }
        }
        logger.info(`Uploaded`);
    }
    async uploadBlock(uploadToken, encryptedBlock, onProgress) {
        const logger = new telemetry_1.LoggerWithPrefix(this.logger, `block ${uploadToken.index}:${uploadToken.token}`);
        logger.info(`Upload started`);
        let blockProgress = 0;
        let attempt = 0;
        while (true) {
            attempt++;
            try {
                logger.debug(`Uploading`);
                await this.apiService.uploadBlock(uploadToken.bareUrl, uploadToken.token, encryptedBlock.encryptedData, (uploadedBytes) => {
                    blockProgress += uploadedBytes;
                    onProgress?.(uploadedBytes);
                }, this.abortController.signal);
                this.uploadedBlocks.push({
                    index: encryptedBlock.index,
                    hash: encryptedBlock.hash,
                    encryptedSize: encryptedBlock.encryptedSize,
                    originalSize: encryptedBlock.originalSize,
                });
                break;
            }
            catch (error) {
                // Do not retry or report anything if the upload was aborted.
                if (error instanceof errors_1.AbortError || this.isUploadAborted) {
                    throw error;
                }
                if (blockProgress !== 0) {
                    onProgress?.(-blockProgress);
                    blockProgress = 0;
                }
                if (error instanceof Error && error.name === 'TimeoutError') {
                    logger.warn(`Upload timeout, limiting upload capacity to 1 block`);
                    await this.limitUploadCapacity(uploadToken.index);
                    logger.warn(`Upload timeout, retrying`);
                    continue;
                }
                if ((error instanceof apiService_1.APIHTTPError && error.statusCode === 404 /* HTTPErrorCode.NOT_FOUND */) ||
                    error instanceof apiService_1.NotFoundAPIError) {
                    logger.warn(`Token expired, fetching new token and retrying`);
                    const uploadTokens = await this.apiService.requestBlockUpload(this.revisionDraft.nodeRevisionUid, this.revisionDraft.nodeKeys.signingKeys.addressId, {
                        contentBlocks: [
                            {
                                index: encryptedBlock.index,
                                encryptedSize: encryptedBlock.encryptedSize,
                                hash: encryptedBlock.hash,
                                armoredSignature: encryptedBlock.armoredSignature,
                                verificationToken: encryptedBlock.verificationToken,
                            },
                        ],
                    });
                    uploadToken = uploadTokens.blockTokens[0];
                    continue;
                }
                // Upload can fail for various reasons, for example integrity
                // can fail due to bitflips. We want to retry and solve the issue
                // seamlessly for the user. We retry only once, because we don't
                // want to get stuck in a loop.
                if (attempt <= MAX_BLOCK_UPLOAD_RETRIES) {
                    logger.warn(`Upload failed #${attempt}, retrying: ${(0, errors_2.getErrorMessage)(error)}`);
                    continue;
                }
                logger.error(`Upload failed`, error);
                await this.abortUpload(error);
                throw error;
            }
        }
        logger.info(`Uploaded`);
    }
    async limitUploadCapacity(index) {
        this.maxUploadingBlocks = 1;
        // This ensures that when the upload is downscaled, all ongoing block
        // uploads are waiting for their turn one by one.
        try {
            await (0, wait_1.waitForCondition)(() => {
                const ongoingIndexes = Array.from(this.ongoingUploads.values())
                    .map(({ index: ongoingIndex }) => ongoingIndex)
                    .filter((ongoingIndex) => ongoingIndex !== undefined);
                ongoingIndexes.sort((a, b) => a - b);
                return ongoingIndexes[0] === index;
            }, this.abortController.signal);
        }
        catch (error) {
            if (error instanceof errors_1.AbortError) {
                return;
            }
            throw error;
        }
    }
    async waitForBufferCapacity() {
        if (this.encryptedBlocks.size >= MAX_BUFFERED_BLOCKS) {
            try {
                await (0, wait_1.waitForCondition)(() => this.encryptedBlocks.size < MAX_BUFFERED_BLOCKS, this.abortController.signal);
            }
            catch (error) {
                if (error instanceof errors_1.AbortError) {
                    return;
                }
                throw error;
            }
        }
    }
    async waitForUploadCapacityAndBufferedBlocks() {
        while (this.ongoingUploads.size >= this.maxUploadingBlocks) {
            await Promise.race(this.ongoingUploads.values().map(({ uploadPromise }) => uploadPromise));
        }
        try {
            await (0, wait_1.waitForCondition)(() => this.encryptedBlocks.size > 0 || this.encryptionFinished, this.abortController.signal);
        }
        catch (error) {
            if (error instanceof errors_1.AbortError) {
                return;
            }
            throw error;
        }
    }
    verifyIntegrity(thumbnails) {
        const expectedBlockCount = Math.ceil(this.metadata.expectedSize / exports.FILE_CHUNK_SIZE) + (thumbnails ? thumbnails?.length : 0);
        if (this.uploadedBlockCount !== expectedBlockCount) {
            throw new errors_1.IntegrityError((0, ttag_1.c)('Error').t `Some file parts failed to upload`, {
                uploadedBlockCount: this.uploadedBlockCount,
                expectedBlockCount,
            });
        }
        if (this.uploadedOriginalFileSize !== this.metadata.expectedSize) {
            throw new errors_1.IntegrityError((0, ttag_1.c)('Error').t `Some file bytes failed to upload`, {
                uploadedOriginalFileSize: this.uploadedOriginalFileSize,
                expectedFileSize: this.metadata.expectedSize,
            });
        }
    }
    /**
     * Check if the encryption is fully finished.
     * This means that all blocks and thumbnails have been encrypted and
     * requested to be uploaded, and there are no more blocks or thumbnails
     * to encrypt and upload.
     */
    get isEncryptionFullyFinished() {
        return this.encryptionFinished && this.encryptedBlocks.size === 0 && this.encryptedThumbnails.size === 0;
    }
    get uploadedBlockCount() {
        return this.uploadedBlocks.length + this.uploadedThumbnails.length;
    }
    get uploadedOriginalFileSize() {
        return this.uploadedBlocks.reduce((sum, { originalSize }) => sum + originalSize, 0);
    }
    get uploadedBlockSizes() {
        const uploadedBlocks = Array.from(this.uploadedBlocks.values());
        uploadedBlocks.sort((a, b) => a.index - b.index);
        return uploadedBlocks.map((block) => block.originalSize);
    }
    get manifest() {
        this.uploadedThumbnails.sort((a, b) => a.type - b.type);
        this.uploadedBlocks.sort((a, b) => a.index - b.index);
        const hashes = [
            ...this.uploadedThumbnails.map(({ hash }) => hash),
            ...this.uploadedBlocks.map(({ hash }) => hash),
        ];
        return (0, utils_1.mergeUint8Arrays)(hashes);
    }
    async abortUpload(error) {
        if (this.isUploadAborted) {
            return;
        }
        this.error = error;
        this.abortController.abort(error);
    }
    get isUploadAborted() {
        return !!this.error || this.abortController.signal.aborted;
    }
}
exports.StreamUploader = StreamUploader;
//# sourceMappingURL=streamUploader.js.map