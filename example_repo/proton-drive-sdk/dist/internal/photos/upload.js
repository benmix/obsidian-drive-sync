"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoUploadAPIService = exports.PhotoUploadCryptoService = exports.PhotoUploadManager = exports.PhotoStreamUploader = exports.PhotoFileUploader = void 0;
const nodes_1 = require("../nodes");
const uids_1 = require("../uids");
const apiService_1 = require("../upload/apiService");
const cryptoService_1 = require("../upload/cryptoService");
const fileUploader_1 = require("../upload/fileUploader");
const manager_1 = require("../upload/manager");
const streamUploader_1 = require("../upload/streamUploader");
class PhotoFileUploader extends fileUploader_1.FileUploader {
    photoApiService;
    photoManager;
    photoMetadata;
    constructor(telemetry, apiService, cryptoService, manager, parentFolderUid, name, metadata, onFinish, signal) {
        super(telemetry, apiService, cryptoService, manager, parentFolderUid, name, metadata, onFinish, signal);
        this.photoApiService = apiService;
        this.photoManager = manager;
        this.photoMetadata = metadata;
    }
    async newStreamUploader(blockVerifier, revisionDraft, onFinish) {
        return new PhotoStreamUploader(this.telemetry, this.photoApiService, this.cryptoService, this.photoManager, blockVerifier, revisionDraft, this.photoMetadata, onFinish, this.controller, this.signal);
    }
}
exports.PhotoFileUploader = PhotoFileUploader;
class PhotoStreamUploader extends streamUploader_1.StreamUploader {
    photoUploadManager;
    photoMetadata;
    constructor(telemetry, apiService, cryptoService, uploadManager, blockVerifier, revisionDraft, metadata, onFinish, controller, signal) {
        const abortController = new AbortController();
        if (signal) {
            signal.addEventListener('abort', () => {
                abortController.abort();
            });
        }
        super(telemetry, apiService, cryptoService, uploadManager, blockVerifier, revisionDraft, metadata, onFinish, controller, abortController);
        this.photoUploadManager = uploadManager;
        this.photoMetadata = metadata;
    }
    async commitFile(thumbnails) {
        this.verifyIntegrity(thumbnails);
        const extendedAttributes = {
            modificationTime: this.metadata.modificationTime,
            size: this.metadata.expectedSize,
            blockSizes: this.uploadedBlockSizes,
            digests: this.digests.digests(),
        };
        await this.photoUploadManager.commitDraftPhoto(this.revisionDraft, this.manifest, extendedAttributes, this.photoMetadata);
    }
}
exports.PhotoStreamUploader = PhotoStreamUploader;
class PhotoUploadManager extends manager_1.UploadManager {
    photoApiService;
    photoCryptoService;
    constructor(telemetry, apiService, cryptoService, nodesService, clientUid) {
        super(telemetry, apiService, cryptoService, nodesService, clientUid);
        this.photoApiService = apiService;
        this.photoCryptoService = cryptoService;
    }
    async commitDraftPhoto(nodeRevisionDraft, manifest, extendedAttributes, uploadMetadata) {
        if (!nodeRevisionDraft.parentNodeKeys) {
            throw new Error('Parent node keys are required for photo upload');
        }
        // TODO: handle photo extended attributes in the SDK - now it must be passed from the client
        const generatedExtendedAttributes = (0, nodes_1.generateFileExtendedAttributes)(extendedAttributes, uploadMetadata.additionalMetadata);
        const nodeCommitCrypto = await this.cryptoService.commitFile(nodeRevisionDraft.nodeKeys, manifest, generatedExtendedAttributes);
        const sha1 = extendedAttributes.digests.sha1;
        const contentHash = await this.photoCryptoService.generateContentHash(sha1, nodeRevisionDraft.parentNodeKeys?.hashKey);
        const photo = {
            contentHash,
            captureTime: uploadMetadata.captureTime || extendedAttributes.modificationTime,
            mainPhotoLinkID: uploadMetadata.mainPhotoLinkID,
            tags: uploadMetadata.tags,
        };
        await this.photoApiService.commitDraftPhoto(nodeRevisionDraft.nodeRevisionUid, nodeCommitCrypto, photo);
        await this.notifyNodeUploaded(nodeRevisionDraft);
    }
}
exports.PhotoUploadManager = PhotoUploadManager;
class PhotoUploadCryptoService extends cryptoService_1.UploadCryptoService {
    constructor(driveCrypto, nodesService) {
        super(driveCrypto, nodesService);
    }
    async generateContentHash(sha1, parentHashKey) {
        return this.driveCrypto.generateLookupHash(sha1, parentHashKey);
    }
}
exports.PhotoUploadCryptoService = PhotoUploadCryptoService;
class PhotoUploadAPIService extends apiService_1.UploadAPIService {
    constructor(apiService, clientUid) {
        super(apiService, clientUid);
    }
    async commitDraftPhoto(draftNodeRevisionUid, options, photo) {
        const { volumeId, nodeId, revisionId } = (0, uids_1.splitNodeRevisionUid)(draftNodeRevisionUid);
        await this.apiService.put(`drive/v2/volumes/${volumeId}/files/${nodeId}/revisions/${revisionId}`, {
            ManifestSignature: options.armoredManifestSignature,
            SignatureAddress: options.signatureEmail,
            XAttr: options.armoredExtendedAttributes || null,
            Photo: {
                ContentHash: photo.contentHash,
                CaptureTime: photo.captureTime ? Math.floor(photo.captureTime?.getTime() / 1000) : 0,
                MainPhotoLinkID: photo.mainPhotoLinkID || null,
                Tags: photo.tags || [],
                Exif: null, // Deprecated field, not used.
            },
        });
    }
}
exports.PhotoUploadAPIService = PhotoUploadAPIService;
//# sourceMappingURL=upload.js.map