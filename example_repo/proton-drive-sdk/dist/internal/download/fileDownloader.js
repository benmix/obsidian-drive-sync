"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileDownloader = void 0;
const ttag_1 = require("ttag");
const crypto_1 = require("../../crypto");
const errors_1 = require("../../errors");
const telemetry_1 = require("../../telemetry");
const apiService_1 = require("../apiService");
const blockIndex_1 = require("./blockIndex");
const controller_1 = require("./controller");
const interface_1 = require("./interface");
const seekableStream_1 = require("./seekableStream");
/**
 * Maximum number of blocks that can be downloaded at the same time
 * for a single file. This is to prevent downloading too many blocks
 * at the same time and running out of memory.
 */
const MAX_DOWNLOAD_BLOCK_SIZE = 10;
class FileDownloader {
    telemetry;
    apiService;
    cryptoService;
    nodeKey;
    revision;
    signal;
    onFinish;
    ignoreManifestVerification;
    logger;
    controller;
    nextBlockIndex = 1;
    ongoingDownloads = new Map();
    constructor(telemetry, apiService, cryptoService, nodeKey, revision, signal, onFinish, ignoreManifestVerification = false) {
        this.telemetry = telemetry;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.nodeKey = nodeKey;
        this.revision = revision;
        this.signal = signal;
        this.onFinish = onFinish;
        this.ignoreManifestVerification = ignoreManifestVerification;
        this.telemetry = telemetry;
        this.logger = telemetry.getLoggerForRevision(revision.uid);
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.nodeKey = nodeKey;
        this.revision = revision;
        this.signal = signal;
        this.onFinish = onFinish;
        this.ignoreManifestVerification = ignoreManifestVerification;
        this.controller = new controller_1.DownloadController(this.signal);
    }
    getClaimedSizeInBytes() {
        return this.revision.claimedSize;
    }
    getSeekableStream() {
        let position = 0;
        let cryptoKeys;
        const logger = new telemetry_1.LoggerWithPrefix(this.logger, `seekable stream`);
        const claimedBlockSizes = this.revision.claimedBlockSizes;
        if (!claimedBlockSizes) {
            // Old nodes will not have claimed block sizes. One option is to
            // use default block size, but old clients didn't use the same
            // size (4 MiB vs 4 MB, for example).
            // Ideally, we should throw error that client can easily handle,
            // at the same time, new nodes shouldn't have this issue.
            // For now, we throw general error that client must handle as any
            // error from download - do not support seeking and ask user to
            // download the whole file instead.
            // In the future, we might either change this error, or have some
            // clever way to detect block sizes from the first block and work
            // around this issue.
            throw new Error('Revision does not have defined claimed block sizes');
        }
        const stream = new seekableStream_1.BufferedSeekableStream({
            start: async () => {
                logger.debug(`Starting`);
                cryptoKeys = await this.cryptoService.getRevisionKeys(this.nodeKey, this.revision);
            },
            pull: async (controller) => {
                logger.debug(`Pulling at position ${position}`);
                const result = await this.downloadDataFromPosition(claimedBlockSizes, position, cryptoKeys);
                if (result instanceof Error) {
                    logger.error('Download failed', result);
                    controller.error(result);
                    return;
                }
                if (!result) {
                    logger.debug(`Download finished at position ${position}`);
                    controller.close();
                    return;
                }
                controller.enqueue(result);
                position += result.length;
            },
            cancel: (reason) => {
                logger.info(`Cancelled: ${reason}`);
                this.onFinish?.();
            },
            seek: async (newPosition) => {
                logger.info(`Seeking to position ${newPosition}`);
                position = newPosition;
            },
        });
        return stream;
    }
    async downloadDataFromPosition(claimedBlockSizes, position, cryptoKeys) {
        const { value, done } = (0, blockIndex_1.getBlockIndex)(claimedBlockSizes, position);
        if (done) {
            return;
        }
        this.logger.info(`Downloading data from block ${value.blockIndex} at offset ${value.blockOffset}`);
        try {
            const { blockIndex, blockOffset } = value;
            const blockMetadata = await this.apiService.getRevisionBlockToken(this.revision.uid, blockIndex, this.signal);
            const blockData = await this.downloadBlockData(blockMetadata, true, cryptoKeys);
            return blockData.slice(blockOffset);
        }
        catch (error) {
            return error instanceof Error ? error : new Error(`Unknown error: ${error}`, { cause: error });
        }
    }
    downloadToStream(stream, onProgress) {
        if (this.controller.promise) {
            throw new Error(`Download already started`);
        }
        this.controller.promise = this.internalDownloadToStream(stream, onProgress);
        return this.controller;
    }
    unsafeDownloadToStream(stream, onProgress) {
        if (this.controller.promise) {
            throw new Error(`Download already started`);
        }
        const ignoreIntegrityErrors = true;
        this.controller.promise = this.internalDownloadToStream(stream, onProgress, ignoreIntegrityErrors);
        return this.controller;
    }
    async internalDownloadToStream(stream, onProgress, ignoreIntegrityErrors = false) {
        const writer = stream.getWriter();
        const cryptoKeys = await this.cryptoService.getRevisionKeys(this.nodeKey, this.revision);
        // File progress is tracked for telemetry - to track at what
        // point the download failed.
        let fileProgress = 0;
        // Collection of all block hashes for manifest verification.
        // This includes both thumbnail and regular blocks.
        const allBlockHashes = [];
        let armoredManifestSignature;
        try {
            this.logger.info(`Starting download`);
            for await (const blockMetadata of this.apiService.iterateRevisionBlocks(this.revision.uid, this.signal)) {
                if (blockMetadata.type === 'manifestSignature') {
                    armoredManifestSignature = blockMetadata.armoredManifestSignature;
                    continue;
                }
                allBlockHashes.push((0, crypto_1.base64StringToUint8Array)(blockMetadata.base64sha256Hash));
                if (blockMetadata.type === 'thumbnail') {
                    continue;
                }
                await this.controller.waitWhilePaused();
                const downloadPromise = this.downloadBlock(blockMetadata, ignoreIntegrityErrors, cryptoKeys, (downloadedBytes) => {
                    fileProgress += downloadedBytes;
                    onProgress?.(fileProgress);
                });
                this.ongoingDownloads.set(blockMetadata.index, { downloadPromise });
                await this.waitForDownloadCapacity();
                await this.flushCompletedBlocks(async (chunk) => {
                    await writer.write(chunk);
                });
            }
            this.logger.debug(`All blocks downloading, waiting for them to finish`);
            await Promise.all(this.downloadPromises);
            await this.flushCompletedBlocks(async (chunk) => {
                await writer.write(chunk);
            });
            if (this.ongoingDownloads.size > 0) {
                this.logger.error(`Some blocks were not downloaded: ${this.ongoingDownloads.keys()}`);
                // This is a bug in the algorithm.
                throw new Error(`Some blocks were not downloaded`);
            }
            if (ignoreIntegrityErrors || this.ignoreManifestVerification) {
                this.logger.warn('Skipping manifest check');
            }
            else {
                this.logger.debug(`Verifying manifest`);
                await this.cryptoService.verifyManifest(this.revision, this.nodeKey.key, allBlockHashes, armoredManifestSignature);
            }
            void this.telemetry.downloadFinished(this.revision.uid, fileProgress);
            this.logger.info(`Download succeeded`);
        }
        catch (error) {
            if (error instanceof interface_1.SignatureVerificationError) {
                this.logger.warn(`Download finished with signature verification issues`);
                this.controller.setIsDownloadCompleteWithSignatureIssues(true);
                error = new errors_1.IntegrityError(error.message, error.debug, { cause: error });
            }
            else {
                this.logger.error(`Download failed`, error);
            }
            void this.telemetry.downloadFailed(this.revision.uid, error, fileProgress, this.getClaimedSizeInBytes());
            throw error;
        }
        finally {
            this.logger.debug(`Download cleanup`);
            this.onFinish?.();
        }
    }
    async downloadBlock(blockMetadata, ignoreIntegrityErrors, cryptoKeys, onProgress) {
        const blockData = await this.downloadBlockData(blockMetadata, ignoreIntegrityErrors, cryptoKeys, onProgress);
        this.ongoingDownloads.get(blockMetadata.index).decryptedBufferedBlock = blockData;
    }
    async downloadBlockData(blockMetadata, ignoreIntegrityErrors, cryptoKeys, onProgress) {
        const logger = new telemetry_1.LoggerWithPrefix(this.logger, `block ${blockMetadata.index}`);
        logger.info(`Download started`);
        let blockProgress = 0;
        let decryptedBlock = null;
        let retries = 0;
        while (!decryptedBlock) {
            logger.debug(`Downloading`);
            await this.controller.waitWhilePaused();
            try {
                const encryptedBlock = await this.apiService.downloadBlock(blockMetadata.bareUrl, blockMetadata.token, (downloadedBytes) => {
                    blockProgress += downloadedBytes;
                    onProgress?.(downloadedBytes);
                }, this.signal);
                if (ignoreIntegrityErrors) {
                    logger.warn('Skipping hash check');
                }
                else {
                    logger.debug(`Verifying hash`);
                    await this.cryptoService.verifyBlockIntegrity(encryptedBlock, blockMetadata.base64sha256Hash);
                }
                logger.debug(`Decrypting`);
                decryptedBlock = await this.cryptoService.decryptBlock(encryptedBlock, cryptoKeys);
            }
            catch (error) {
                if (this.signal?.aborted) {
                    throw new errors_1.AbortError((0, ttag_1.c)('Error').t `Operation aborted`);
                }
                if (blockProgress !== 0) {
                    onProgress?.(-blockProgress);
                    blockProgress = 0;
                }
                if (error instanceof apiService_1.APIHTTPError && error.statusCode === 404 /* HTTPErrorCode.NOT_FOUND */) {
                    logger.warn(`Token expired, fetching new token and retrying`);
                    blockMetadata = await this.apiService.getRevisionBlockToken(this.revision.uid, blockMetadata.index, this.signal);
                    continue;
                }
                // Download can fail for various reasons, for example integrity
                // can fail due to bitflips. We want to retry and solve the issue
                // seamlessly for the user. We retry only once, because we don't
                // want to get stuck in a loop.
                if (retries === 0) {
                    logger.error(`Download failed, retrying`, error);
                    retries++;
                    continue;
                }
                logger.error(`Download failed`, error);
                throw error;
            }
        }
        logger.info(`Downloaded`);
        return decryptedBlock;
    }
    async waitForDownloadCapacity() {
        if (this.ongoingDownloads.size >= MAX_DOWNLOAD_BLOCK_SIZE) {
            this.logger.info(`Download limit reached, waiting for next block to be finished`);
            // We need to ensure the next block is downloaded, otherwise the
            // buffer will still be full.
            while (!this.isNextBlockDownloaded) {
                // Promise.race never finishes if the passed array is empty.
                // It shouldn't happen if at least next block is still not downloaded,
                // also JS is single threaded, so it should be impossible to change
                // the ongoing downloads in the middle of the loop. It is handled
                // just in case something is changed that would affect this part
                // without noticing.
                const ongoingDownloadPromises = Array.from(this.ongoingDownloadPromises);
                if (ongoingDownloadPromises.length === 0) {
                    break;
                }
                // Promise.race is used to ensure if any block fails, the error is
                // thrown up the chain and we dont end up in stuck loop here waiting
                // for the next block to be ready.
                // We wait only for the ongoing downloads as if we use all promises,
                // some block can be finished and it would result in inifinite loop.
                await Promise.race(ongoingDownloadPromises);
            }
        }
    }
    async flushCompletedBlocks(write) {
        this.logger.debug(`Flushing completed blocks`);
        while (this.isNextBlockDownloaded) {
            const decryptedBlock = this.ongoingDownloads.get(this.nextBlockIndex).decryptedBufferedBlock;
            this.logger.info(`Flushing completed block ${this.nextBlockIndex}`);
            try {
                await write(decryptedBlock);
            }
            catch (error) {
                this.logger.error(`Failed to write block, retrying once`, error);
                await write(decryptedBlock);
            }
            this.ongoingDownloads.delete(this.nextBlockIndex);
            this.nextBlockIndex++;
        }
    }
    get downloadPromises() {
        return this.ongoingDownloads.values().map(({ downloadPromise }) => downloadPromise);
    }
    get ongoingDownloadPromises() {
        return this.ongoingDownloads
            .values()
            .filter((value) => value.decryptedBufferedBlock === undefined)
            .map((value) => value.downloadPromise);
    }
    get isNextBlockDownloaded() {
        return !!this.ongoingDownloads.get(this.nextBlockIndex)?.decryptedBufferedBlock;
    }
}
exports.FileDownloader = FileDownloader;
//# sourceMappingURL=fileDownloader.js.map