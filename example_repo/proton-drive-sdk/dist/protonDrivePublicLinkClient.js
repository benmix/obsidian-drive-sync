"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtonDrivePublicLinkClient = void 0;
const cache_1 = require("./cache");
const config_1 = require("./config");
const crypto_1 = require("./crypto");
const telemetry_1 = require("./telemetry");
const transformers_1 = require("./transformers");
const download_1 = require("./internal/download");
const sdkEvents_1 = require("./internal/sdkEvents");
const sharingPublic_1 = require("./internal/sharingPublic");
const upload_1 = require("./internal/upload");
/**
 * ProtonDrivePublicLinkClient is the interface for the public link client.
 *
 * The client provides high-level operations for managing nodes, and
 * downloading/uploading files.
 *
 * Do not use this client direclty, use ProtonDriveClient instead.
 * The main client handles public link sessions and provides access to
 * public links.
 *
 * See `experimental.getPublicLinkInfo` and `experimental.authPublicLink`
 * for more information.
 */
class ProtonDrivePublicLinkClient {
    logger;
    sdkEvents;
    sharingPublic;
    download;
    upload;
    experimental;
    constructor({ httpClient, account, openPGPCryptoModule, srpModule, config, telemetry, url, token, publicShareKey, publicRootNodeUid, isAnonymousContext, publicRole, }) {
        if (!telemetry) {
            telemetry = new telemetry_1.Telemetry();
        }
        this.logger = telemetry.getLogger('publicLink-interface');
        // Use only in memory cache for public link as there are no events to keep it up to date if persisted.
        const entitiesCache = new cache_1.MemoryCache();
        const cryptoCache = new cache_1.MemoryCache();
        const fullConfig = (0, config_1.getConfig)(config);
        this.sdkEvents = new sdkEvents_1.SDKEvents(telemetry);
        const apiService = new sharingPublic_1.UnauthDriveAPIService(telemetry, this.sdkEvents, httpClient, fullConfig.baseUrl, fullConfig.language);
        const cryptoModule = new crypto_1.DriveCrypto(openPGPCryptoModule, srpModule);
        this.sharingPublic = (0, sharingPublic_1.initSharingPublicModule)(telemetry, apiService, entitiesCache, cryptoCache, cryptoModule, account, url, token, publicShareKey, publicRootNodeUid, publicRole, isAnonymousContext);
        this.download = (0, download_1.initDownloadModule)(telemetry, apiService, cryptoModule, account, this.sharingPublic.shares, this.sharingPublic.nodes.access, this.sharingPublic.nodes.revisions, 
        // Ignore manifest integrity verifications for public links.
        // Anonymous user on public page cannot load public keys of other users (yet).
        true);
        this.upload = (0, upload_1.initUploadModule)(telemetry, apiService, cryptoModule, this.sharingPublic.shares, this.sharingPublic.nodes.access, fullConfig.clientUid);
        this.experimental = {
            getNodeUrl: async (nodeUid) => {
                this.logger.debug(`Getting node URL for ${(0, transformers_1.getUid)(nodeUid)}`);
                return this.sharingPublic.nodes.access.getNodeUrl((0, transformers_1.getUid)(nodeUid));
            },
            getDocsKey: async (nodeUid) => {
                this.logger.debug(`Getting docs keys for ${(0, transformers_1.getUid)(nodeUid)}`);
                const keys = await this.sharingPublic.nodes.access.getNodeKeys((0, transformers_1.getUid)(nodeUid));
                if (!keys.contentKeyPacketSessionKey) {
                    throw new Error('Node does not have a content key packet session key');
                }
                return keys.contentKeyPacketSessionKey;
            },
        };
    }
    /**
     * Subscribes to the general SDK events.
     *
     * See `ProtonDriveClient.onMessage` for more information.
     */
    onMessage(eventName, callback) {
        this.logger.debug(`Subscribing to event ${eventName}`);
        return this.sdkEvents.addListener(eventName, callback);
    }
    /**
     * @returns The root folder to the public link.
     */
    async getRootNode() {
        this.logger.info(`Getting root node`);
        const { rootNodeUid } = await this.sharingPublic.shares.getRootIDs();
        return (0, transformers_1.convertInternalNodePromise)(this.sharingPublic.nodes.access.getNode(rootNodeUid));
    }
    /**
     * Iterates the children of the given parent node.
     *
     * See `ProtonDriveClient.iterateFolderChildren` for more information.
     */
    async *iterateFolderChildren(parentUid, filterOptions, signal) {
        this.logger.info(`Iterating children of ${(0, transformers_1.getUid)(parentUid)}`);
        yield* (0, transformers_1.convertInternalNodeIterator)(this.sharingPublic.nodes.access.iterateFolderChildren((0, transformers_1.getUid)(parentUid), filterOptions, signal));
    }
    /**
     * Iterates the nodes by their UIDs.
     *
     * See `ProtonDriveClient.iterateNodes` for more information.
     */
    async *iterateNodes(nodeUids, signal) {
        this.logger.info(`Iterating ${nodeUids.length} nodes`);
        yield* (0, transformers_1.convertInternalMissingNodeIterator)(this.sharingPublic.nodes.access.iterateNodes((0, transformers_1.getUids)(nodeUids), signal));
    }
    /**
     * Get the node by its UID.
     *
     * See `ProtonDriveClient.getNode` for more information.
     */
    async getNode(nodeUid) {
        this.logger.info(`Getting node ${(0, transformers_1.getUid)(nodeUid)}`);
        return (0, transformers_1.convertInternalNodePromise)(this.sharingPublic.nodes.access.getNode((0, transformers_1.getUid)(nodeUid)));
    }
    /**
     * Rename the node.
     *
     * See `ProtonDriveClient.renameNode` for more information.
     */
    async renameNode(nodeUid, newName) {
        this.logger.info(`Renaming node ${(0, transformers_1.getUid)(nodeUid)}`);
        return (0, transformers_1.convertInternalNodePromise)(this.sharingPublic.nodes.management.renameNode((0, transformers_1.getUid)(nodeUid), newName));
    }
    /**
     * Delete own nodes permanently. It skips the trash and allows to delete
     * only nodes that are owned by the user. For anonymous files, this method
     * allows to delete them only in the same session.
     *
     * See `ProtonDriveClient.deleteNodes` for more information.
     */
    async *deleteNodes(nodeUids, signal) {
        this.logger.info(`Deleting ${nodeUids.length} nodes`);
        yield* this.sharingPublic.nodes.management.deleteMyNodes((0, transformers_1.getUids)(nodeUids), signal);
    }
    /**
     * Create a new folder.
     *
     * See `ProtonDriveClient.createFolder` for more information.
     */
    async createFolder(parentNodeUid, name, modificationTime) {
        this.logger.info(`Creating folder in ${(0, transformers_1.getUid)(parentNodeUid)}`);
        return (0, transformers_1.convertInternalNodePromise)(this.sharingPublic.nodes.management.createFolder((0, transformers_1.getUid)(parentNodeUid), name, modificationTime));
    }
    /**
     * Get the file downloader to download the node content.
     *
     * See `ProtonDriveClient.getFileDownloader` for more information.
     */
    async getFileDownloader(nodeUid, signal) {
        this.logger.info(`Getting file downloader for ${(0, transformers_1.getUid)(nodeUid)}`);
        return this.download.getFileDownloader((0, transformers_1.getUid)(nodeUid), signal);
    }
    /**
     * Iterates the thumbnails of the given nodes.
     *
     * See `ProtonDriveClient.iterateThumbnails` for more information.
     */
    async *iterateThumbnails(nodeUids, thumbnailType, signal) {
        this.logger.info(`Iterating ${nodeUids.length} thumbnails`);
        yield* this.download.iterateThumbnails((0, transformers_1.getUids)(nodeUids), thumbnailType, signal);
    }
    /**
     * Get the file uploader to upload a new file. For uploading a new
     * revision, use `getFileRevisionUploader` instead.
     *
     * See `ProtonDriveClient.getFileUploader` for more information.
     */
    async getFileUploader(parentFolderUid, name, metadata, signal) {
        this.logger.info(`Getting file uploader for parent ${(0, transformers_1.getUid)(parentFolderUid)}`);
        return this.upload.getFileUploader((0, transformers_1.getUid)(parentFolderUid), name, metadata, signal);
    }
    /**
     * Same as `getFileUploader`, but for a uploading new revision of the file.
     *
     * See `ProtonDriveClient.getFileRevisionUploader` for more information.
     */
    async getFileRevisionUploader(nodeUid, metadata, signal) {
        this.logger.info(`Getting file revision uploader for ${(0, transformers_1.getUid)(nodeUid)}`);
        return this.upload.getFileRevisionUploader((0, transformers_1.getUid)(nodeUid), metadata, signal);
    }
}
exports.ProtonDrivePublicLinkClient = ProtonDrivePublicLinkClient;
//# sourceMappingURL=protonDrivePublicLinkClient.js.map