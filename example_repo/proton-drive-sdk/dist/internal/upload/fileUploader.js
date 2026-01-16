"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileRevisionUploader = exports.FileUploader = void 0;
const blockVerifier_1 = require("./blockVerifier");
const controller_1 = require("./controller");
const streamUploader_1 = require("./streamUploader");
/**
 * Uploader is generic class responsible for creating a revision draft
 * and initiate the upload process for a file object or a stream.
 *
 * This class is not meant to be used directly, but rather to be extended
 * by `FileUploader` and `FileRevisionUploader`.
 */
class Uploader {
    telemetry;
    apiService;
    cryptoService;
    manager;
    metadata;
    onFinish;
    signal;
    controller;
    abortController;
    constructor(telemetry, apiService, cryptoService, manager, metadata, onFinish, signal) {
        this.telemetry = telemetry;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.manager = manager;
        this.metadata = metadata;
        this.onFinish = onFinish;
        this.signal = signal;
        this.telemetry = telemetry;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.manager = manager;
        this.metadata = metadata;
        this.onFinish = onFinish;
        this.signal = signal;
        this.abortController = new AbortController();
        if (signal) {
            signal.addEventListener('abort', () => {
                this.abortController.abort();
            });
        }
        this.controller = new controller_1.UploadController(this.abortController.signal);
    }
    async uploadFromFile(fileObject, thumbnails, onProgress) {
        if (this.controller.promise) {
            throw new Error(`Upload already started`);
        }
        if (!this.metadata.mediaType) {
            this.metadata.mediaType = fileObject.type;
        }
        if (!this.metadata.expectedSize) {
            this.metadata.expectedSize = fileObject.size;
        }
        if (!this.metadata.modificationTime) {
            this.metadata.modificationTime = new Date(fileObject.lastModified);
        }
        this.controller.promise = this.startUpload(fileObject.stream(), thumbnails, onProgress);
        return this.controller;
    }
    async uploadFromStream(stream, thumbnails, onProgress) {
        if (this.controller.promise) {
            throw new Error(`Upload already started`);
        }
        this.controller.promise = this.startUpload(stream, thumbnails, onProgress);
        return this.controller;
    }
    async startUpload(stream, thumbnails, onProgress) {
        const uploader = await this.initStreamUploader();
        return uploader.start(stream, thumbnails, onProgress);
    }
    async initStreamUploader() {
        const { revisionDraft, blockVerifier } = await this.createRevisionDraft();
        const onFinish = async (failure) => {
            this.onFinish();
            if (failure) {
                await this.deleteRevisionDraft(revisionDraft);
            }
        };
        return this.newStreamUploader(blockVerifier, revisionDraft, onFinish);
    }
    async newStreamUploader(blockVerifier, revisionDraft, onFinish) {
        return new streamUploader_1.StreamUploader(this.telemetry, this.apiService, this.cryptoService, this.manager, blockVerifier, revisionDraft, this.metadata, onFinish, this.controller, this.abortController);
    }
}
/**
 * Uploader implementation for a new file.
 */
class FileUploader extends Uploader {
    parentFolderUid;
    name;
    constructor(telemetry, apiService, cryptoService, manager, parentFolderUid, name, metadata, onFinish, signal) {
        super(telemetry, apiService, cryptoService, manager, metadata, onFinish, signal);
        this.parentFolderUid = parentFolderUid;
        this.name = name;
        this.parentFolderUid = parentFolderUid;
        this.name = name;
    }
    async createRevisionDraft() {
        let revisionDraft, blockVerifier;
        try {
            revisionDraft = await this.manager.createDraftNode(this.parentFolderUid, this.name, this.metadata);
            blockVerifier = new blockVerifier_1.BlockVerifier(this.apiService, this.cryptoService, revisionDraft.nodeKeys.key, revisionDraft.nodeRevisionUid);
            await blockVerifier.loadVerificationData();
        }
        catch (error) {
            this.onFinish();
            if (revisionDraft) {
                await this.manager.deleteDraftNode(revisionDraft.nodeUid);
            }
            void this.telemetry.uploadInitFailed(this.parentFolderUid, error, this.metadata.expectedSize);
            throw error;
        }
        return {
            revisionDraft,
            blockVerifier,
        };
    }
    async deleteRevisionDraft(revisionDraft) {
        await this.manager.deleteDraftNode(revisionDraft.nodeUid);
    }
}
exports.FileUploader = FileUploader;
/**
 * Uploader implementation for a new file revision.
 */
class FileRevisionUploader extends Uploader {
    nodeUid;
    constructor(telemetry, apiService, cryptoService, manager, nodeUid, metadata, onFinish, signal) {
        super(telemetry, apiService, cryptoService, manager, metadata, onFinish, signal);
        this.nodeUid = nodeUid;
        this.nodeUid = nodeUid;
    }
    async createRevisionDraft() {
        let revisionDraft, blockVerifier;
        try {
            revisionDraft = await this.manager.createDraftRevision(this.nodeUid, this.metadata);
            blockVerifier = new blockVerifier_1.BlockVerifier(this.apiService, this.cryptoService, revisionDraft.nodeKeys.key, revisionDraft.nodeRevisionUid);
            await blockVerifier.loadVerificationData();
        }
        catch (error) {
            this.onFinish();
            if (revisionDraft) {
                await this.manager.deleteDraftRevision(revisionDraft.nodeRevisionUid);
            }
            void this.telemetry.uploadInitFailed(this.nodeUid, error, this.metadata.expectedSize);
            throw error;
        }
        return {
            revisionDraft,
            blockVerifier,
        };
    }
    async deleteRevisionDraft(revisionDraft) {
        await this.manager.deleteDraftRevision(revisionDraft.nodeRevisionUid);
    }
}
exports.FileRevisionUploader = FileRevisionUploader;
//# sourceMappingURL=fileUploader.js.map