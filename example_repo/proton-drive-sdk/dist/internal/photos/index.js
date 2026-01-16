"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHOTOS_SHARE_TARGET_TYPES = void 0;
exports.initPhotosModule = initPhotosModule;
exports.initPhotoSharesModule = initPhotoSharesModule;
exports.initPhotosNodesModule = initPhotosNodesModule;
exports.initPhotoUploadModule = initPhotoUploadModule;
const cryptoService_1 = require("../nodes/cryptoService");
const cryptoReporter_1 = require("../nodes/cryptoReporter");
const cryptoCache_1 = require("../nodes/cryptoCache");
const shares_1 = require("../shares");
const cache_1 = require("../shares/cache");
const cryptoCache_2 = require("../shares/cryptoCache");
const cryptoService_2 = require("../shares/cryptoService");
const telemetry_1 = require("../upload/telemetry");
const queue_1 = require("../upload/queue");
const albums_1 = require("./albums");
const apiService_1 = require("./apiService");
const nodes_1 = require("./nodes");
const shares_2 = require("./shares");
const timeline_1 = require("./timeline");
const upload_1 = require("./upload");
const nodesRevisions_1 = require("../nodes/nodesRevisions");
const events_1 = require("../nodes/events");
// Only photos and albums can be shared in photos volume.
exports.PHOTOS_SHARE_TARGET_TYPES = [shares_1.ShareTargetType.Photo, shares_1.ShareTargetType.Album];
/**
 * Provides facade for the whole photos module.
 *
 * The photos module is responsible for handling photos and albums metadata,
 * including API communication, crypto, caching, and event handling.
 */
function initPhotosModule(telemetry, apiService, driveCrypto, photoShares, nodesService) {
    const api = new apiService_1.PhotosAPIService(apiService);
    const timeline = new timeline_1.PhotosTimeline(telemetry.getLogger('photos-timeline'), api, driveCrypto, photoShares, nodesService);
    const albums = new albums_1.Albums(api, photoShares, nodesService);
    return {
        timeline,
        albums,
    };
}
/**
 * Provides facade for the photo share module.
 *
 * The photo share wraps the core share module, but uses photos volume instead
 * of main volume. It provides the same interface so it can be used in the same
 * way in various modules that use shares.
 */
function initPhotoSharesModule(telemetry, apiService, driveEntitiesCache, driveCryptoCache, account, crypto, sharesService) {
    const api = new apiService_1.PhotosAPIService(apiService);
    const cache = new cache_1.SharesCache(telemetry.getLogger('shares-cache'), driveEntitiesCache);
    const cryptoCache = new cryptoCache_2.SharesCryptoCache(telemetry.getLogger('shares-cache'), driveCryptoCache);
    const cryptoService = new cryptoService_2.SharesCryptoService(telemetry, crypto, account);
    return new shares_2.PhotoSharesManager(telemetry.getLogger('photos-shares'), api, cache, cryptoCache, cryptoService, sharesService);
}
/**
 * Provides facade for the photo nodes module.
 *
 * The photo nodes module wraps the core nodes module and adds photo specific
 * metadata. It provides the same interface so it can be used in the same way.
 */
function initPhotosNodesModule(telemetry, apiService, driveEntitiesCache, driveCryptoCache, account, driveCrypto, sharesService, clientUid) {
    const api = new nodes_1.PhotosNodesAPIService(telemetry.getLogger('nodes-api'), apiService, clientUid);
    const cache = new nodes_1.PhotosNodesCache(telemetry.getLogger('nodes-cache'), driveEntitiesCache);
    const cryptoCache = new cryptoCache_1.NodesCryptoCache(telemetry.getLogger('nodes-cache'), driveCryptoCache);
    const cryptoReporter = new cryptoReporter_1.NodesCryptoReporter(telemetry, sharesService);
    const cryptoService = new cryptoService_1.NodesCryptoService(telemetry, driveCrypto, account, cryptoReporter);
    const nodesAccess = new nodes_1.PhotosNodesAccess(telemetry, api, cache, cryptoCache, cryptoService, sharesService);
    const nodesEventHandler = new events_1.NodesEventsHandler(telemetry.getLogger('nodes-events'), cache);
    const nodesManagement = new nodes_1.PhotosNodesManagement(api, cryptoCache, cryptoService, nodesAccess);
    const nodesRevisions = new nodesRevisions_1.NodesRevisons(telemetry.getLogger('nodes'), api, cryptoService, nodesAccess);
    return {
        access: nodesAccess,
        management: nodesManagement,
        revisions: nodesRevisions,
        eventHandler: nodesEventHandler,
    };
}
/**
 * Provides facade for the photo upload module.
 *
 * The photo upload wraps the core upload module and adds photo specific metadata.
 * It provides the same interface so it can be used in the same way.
 */
function initPhotoUploadModule(telemetry, apiService, driveCrypto, sharesService, nodesService, clientUid) {
    const api = new upload_1.PhotoUploadAPIService(apiService, clientUid);
    const cryptoService = new upload_1.PhotoUploadCryptoService(driveCrypto, nodesService);
    const uploadTelemetry = new telemetry_1.UploadTelemetry(telemetry, sharesService);
    const manager = new upload_1.PhotoUploadManager(telemetry, api, cryptoService, nodesService, clientUid);
    const queue = new queue_1.UploadQueue();
    async function getFileUploader(parentFolderUid, name, metadata, signal) {
        await queue.waitForCapacity(metadata.expectedSize, signal);
        const onFinish = () => {
            queue.releaseCapacity(metadata.expectedSize);
        };
        return new upload_1.PhotoFileUploader(uploadTelemetry, api, cryptoService, manager, parentFolderUid, name, metadata, onFinish, signal);
    }
    return {
        getFileUploader,
    };
}
//# sourceMappingURL=index.js.map