"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initUploadModule = initUploadModule;
const apiService_1 = require("./apiService");
const cryptoService_1 = require("./cryptoService");
const fileUploader_1 = require("./fileUploader");
const manager_1 = require("./manager");
const queue_1 = require("./queue");
const telemetry_1 = require("./telemetry");
/**
 * Provides facade for the upload module.
 *
 * The upload module is responsible for handling file uploads, including
 * metadata generation, content upload, API communication, encryption,
 * and verifications.
 */
function initUploadModule(telemetry, apiService, driveCrypto, sharesService, nodesService, clientUid) {
    const api = new apiService_1.UploadAPIService(apiService, clientUid);
    const cryptoService = new cryptoService_1.UploadCryptoService(driveCrypto, nodesService);
    const uploadTelemetry = new telemetry_1.UploadTelemetry(telemetry, sharesService);
    const manager = new manager_1.UploadManager(telemetry, api, cryptoService, nodesService, clientUid);
    const queue = new queue_1.UploadQueue();
    /**
     * Returns a FileUploader instance that can be used to upload a file to
     * a parent folder.
     *
     * This operation does not call the API, it only returns a FileUploader
     * instance when the upload queue has capacity.
     */
    async function getFileUploader(parentFolderUid, name, metadata, signal) {
        await queue.waitForCapacity(metadata.expectedSize, signal);
        const onFinish = () => {
            queue.releaseCapacity(metadata.expectedSize);
        };
        return new fileUploader_1.FileUploader(uploadTelemetry, api, cryptoService, manager, parentFolderUid, name, metadata, onFinish, signal);
    }
    /**
     * Returns a FileUploader instance that can be used to upload a new
     * revision of a file.
     *
     * This operation does not call the API, it only returns a
     * FileRevisionUploader instance when the upload queue has capacity.
     */
    async function getFileRevisionUploader(nodeUid, metadata, signal) {
        await queue.waitForCapacity(metadata.expectedSize, signal);
        const onFinish = () => {
            queue.releaseCapacity(metadata.expectedSize);
        };
        return new fileUploader_1.FileRevisionUploader(uploadTelemetry, api, cryptoService, manager, nodeUid, metadata, onFinish, signal);
    }
    return {
        getFileUploader,
        getFileRevisionUploader,
    };
}
//# sourceMappingURL=index.js.map