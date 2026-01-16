"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDownloadModule = initDownloadModule;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
const interface_1 = require("../../interface");
const apiService_1 = require("./apiService");
const cryptoService_1 = require("./cryptoService");
const fileDownloader_1 = require("./fileDownloader");
const queue_1 = require("./queue");
const telemetry_1 = require("./telemetry");
const uids_1 = require("../uids");
const thumbnailDownloader_1 = require("./thumbnailDownloader");
function initDownloadModule(telemetry, apiService, driveCrypto, account, sharesService, nodesService, revisionsService, ignoreManifestVerification = false) {
    const queue = new queue_1.DownloadQueue();
    const api = new apiService_1.DownloadAPIService(apiService);
    const cryptoService = new cryptoService_1.DownloadCryptoService(driveCrypto, account);
    const downloadTelemetry = new telemetry_1.DownloadTelemetry(telemetry, sharesService);
    async function getFileDownloader(nodeUid, signal) {
        await queue.waitForCapacity(signal);
        let node, nodeKey;
        try {
            node = await nodesService.getNode(nodeUid);
            nodeKey = await nodesService.getNodeKeys(nodeUid);
            if (node.type === interface_1.NodeType.Folder) {
                throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Cannot download a folder`);
            }
            if (!nodeKey.contentKeyPacketSessionKey) {
                throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `File has no content key`);
            }
            if (!node.activeRevision?.ok || !node.activeRevision.value) {
                throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `File has no active revision`);
            }
        }
        catch (error) {
            queue.releaseCapacity();
            void downloadTelemetry.downloadInitFailed(nodeUid, error);
            throw error;
        }
        const onFinish = () => queue.releaseCapacity();
        return new fileDownloader_1.FileDownloader(downloadTelemetry, api, cryptoService, {
            key: nodeKey.key,
            contentKeyPacketSessionKey: nodeKey.contentKeyPacketSessionKey,
        }, node.activeRevision.value, signal, onFinish, ignoreManifestVerification);
    }
    async function getFileRevisionDownloader(nodeRevisionUid, signal) {
        await queue.waitForCapacity(signal);
        const nodeUid = (0, uids_1.makeNodeUidFromRevisionUid)(nodeRevisionUid);
        let node, nodeKey, revision;
        try {
            node = await nodesService.getNode(nodeUid);
            nodeKey = await nodesService.getNodeKeys(nodeUid);
            revision = await revisionsService.getRevision(nodeRevisionUid);
            if (node.type === interface_1.NodeType.Folder) {
                throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Cannot download a folder`);
            }
            if (!nodeKey.contentKeyPacketSessionKey) {
                throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `File has no content key`);
            }
        }
        catch (error) {
            queue.releaseCapacity();
            void downloadTelemetry.downloadInitFailed(nodeUid, error);
            throw error;
        }
        const onFinish = () => queue.releaseCapacity();
        return new fileDownloader_1.FileDownloader(downloadTelemetry, api, cryptoService, {
            key: nodeKey.key,
            contentKeyPacketSessionKey: nodeKey.contentKeyPacketSessionKey,
        }, revision, signal, onFinish, ignoreManifestVerification);
    }
    async function* iterateThumbnails(nodeUids, thumbnailType, signal) {
        const thumbnailDownloader = new thumbnailDownloader_1.ThumbnailDownloader(telemetry, nodesService, api, cryptoService);
        yield* thumbnailDownloader.iterateThumbnails(nodeUids, thumbnailType, signal);
    }
    return {
        getFileDownloader,
        getFileRevisionDownloader,
        iterateThumbnails,
    };
}
//# sourceMappingURL=index.js.map