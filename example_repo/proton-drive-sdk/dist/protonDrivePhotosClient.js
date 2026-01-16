"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtonDrivePhotosClient = void 0;
const config_1 = require("./config");
const crypto_1 = require("./crypto");
const telemetry_1 = require("./telemetry");
const transformers_1 = require("./transformers");
const apiService_1 = require("./internal/apiService");
const download_1 = require("./internal/download");
const events_1 = require("./internal/events");
const photos_1 = require("./internal/photos");
const sdkEvents_1 = require("./internal/sdkEvents");
const shares_1 = require("./internal/shares");
const sharing_1 = require("./internal/sharing");
/**
 * ProtonDrivePhotosClient is the interface to access Photos functionality.
 *
 * The client provides high-level operations for managing photos, albums, sharing,
 * and downloading/uploading photos.
 *
 * @deprecated This is an experimental feature that might change without a warning.
 */
class ProtonDrivePhotosClient {
    logger;
    sdkEvents;
    events;
    photoShares;
    nodes;
    sharing;
    download;
    upload;
    photos;
    experimental;
    constructor({ httpClient, entitiesCache, cryptoCache, account, openPGPCryptoModule, srpModule, config, telemetry, latestEventIdProvider, }) {
        if (!telemetry) {
            telemetry = new telemetry_1.Telemetry();
        }
        this.logger = telemetry.getLogger('photos-interface');
        const fullConfig = (0, config_1.getConfig)(config);
        this.sdkEvents = new sdkEvents_1.SDKEvents(telemetry);
        const cryptoModule = new crypto_1.DriveCrypto(openPGPCryptoModule, srpModule);
        const apiService = new apiService_1.DriveAPIService(telemetry, this.sdkEvents, httpClient, fullConfig.baseUrl, fullConfig.language);
        const coreShares = (0, shares_1.initSharesModule)(telemetry, apiService, entitiesCache, cryptoCache, account, cryptoModule);
        this.photoShares = (0, photos_1.initPhotoSharesModule)(telemetry, apiService, entitiesCache, cryptoCache, account, cryptoModule, coreShares);
        this.nodes = (0, photos_1.initPhotosNodesModule)(telemetry, apiService, entitiesCache, cryptoCache, account, cryptoModule, this.photoShares, fullConfig.clientUid);
        this.photos = (0, photos_1.initPhotosModule)(telemetry, apiService, cryptoModule, this.photoShares, this.nodes.access);
        this.sharing = (0, sharing_1.initSharingModule)(telemetry, apiService, entitiesCache, account, cryptoModule, this.photoShares, this.nodes.access, photos_1.PHOTOS_SHARE_TARGET_TYPES);
        this.download = (0, download_1.initDownloadModule)(telemetry, apiService, cryptoModule, account, this.photoShares, this.nodes.access, this.nodes.revisions);
        this.upload = (0, photos_1.initPhotoUploadModule)(telemetry, apiService, cryptoModule, this.photoShares, this.nodes.access, fullConfig.clientUid);
        // These are used to keep the internal cache up to date
        const cacheEventListeners = [
            this.nodes.eventHandler.updateNodesCacheOnEvent.bind(this.nodes.eventHandler),
            this.sharing.eventHandler.handleDriveEvent.bind(this.sharing.eventHandler),
        ];
        this.events = new events_1.DriveEventsService(telemetry, apiService, this.photoShares, cacheEventListeners, latestEventIdProvider);
        this.experimental = {
            getNodeUrl: async (nodeUid) => {
                this.logger.debug(`Getting node URL for ${(0, transformers_1.getUid)(nodeUid)}`);
                return this.nodes.access.getNodeUrl((0, transformers_1.getUid)(nodeUid));
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
     * Subscribes to the remote data updates for all files in a tree.
     *
     * See `ProtonDriveClient.subscribeToTreeEvents` for more information.
     */
    async subscribeToTreeEvents(treeEventScopeId, callback) {
        this.logger.debug('Subscribing to node updates');
        return this.events.subscribeToTreeEvents(treeEventScopeId, callback);
    }
    /**
     * Subscribes to the remote general data updates.
     *
     * See `ProtonDriveClient.subscribeToDriveEvents` for more information.
     */
    async subscribeToDriveEvents(callback) {
        this.logger.debug('Subscribing to core updates');
        return this.events.subscribeToCoreEvents(callback);
    }
    /**
     * @returns The root folder to Photos section of the user.
     */
    async getMyPhotosRootFolder() {
        this.logger.info('Getting my photos root folder');
        return (0, transformers_1.convertInternalPhotoNodePromise)(this.nodes.access.getVolumeRootFolder());
    }
    /**
     * Iterates all the photos for the timeline view.
     *
     * The output includes only necessary information to quickly prepare
     * the whole timeline view with the break-down per month/year and fast
     * scrollbar.
     *
     * Individual photos details must be loaded separately based on what
     * is visible in the UI.
     *
     * The output is sorted by the capture time, starting from the
     * the most recent photos.
     */
    async *iterateTimeline(signal) {
        // TODO: expose better type
        yield* this.photos.timeline.iterateTimeline(signal);
    }
    /**
     * Iterates the trashed nodes.
     *
     * See `ProtonDriveClient.iterateTrashedNodes` for more information.
     */
    async *iterateTrashedNodes(signal) {
        this.logger.info('Iterating trashed nodes');
        yield* (0, transformers_1.convertInternalPhotoNodeIterator)(this.nodes.access.iterateTrashedNodes(signal));
    }
    /**
     * Iterates the nodes by their UIDs.
     *
     * See `ProtonDriveClient.iterateNodes` for more information.
     */
    async *iterateNodes(nodeUids, signal) {
        this.logger.info(`Iterating ${nodeUids.length} nodes`);
        // TODO: expose photo type
        yield* (0, transformers_1.convertInternalMissingPhotoNodeIterator)(this.nodes.access.iterateNodes((0, transformers_1.getUids)(nodeUids), signal));
    }
    /**
     * Get the node by its UID.
     *
     * See `ProtonDriveClient.getNode` for more information.
     */
    async getNode(nodeUid) {
        this.logger.info(`Getting node ${(0, transformers_1.getUid)(nodeUid)}`);
        return (0, transformers_1.convertInternalPhotoNodePromise)(this.nodes.access.getNode((0, transformers_1.getUid)(nodeUid)));
    }
    /**
     * Rename the node.
     *
     * See `ProtonDriveClient.renameNode` for more information.
     */
    async renameNode(nodeUid, newName) {
        this.logger.info(`Renaming node ${(0, transformers_1.getUid)(nodeUid)}`);
        return (0, transformers_1.convertInternalPhotoNodePromise)(this.nodes.management.renameNode((0, transformers_1.getUid)(nodeUid), newName));
    }
    /**
     * Trash the nodes.
     *
     * See `ProtonDriveClient.trashNodes` for more information.
     */
    async *trashNodes(nodeUids, signal) {
        this.logger.info(`Trashing ${nodeUids.length} nodes`);
        yield* this.nodes.management.trashNodes((0, transformers_1.getUids)(nodeUids), signal);
    }
    /**
     * Restore the nodes from the trash to their original place.
     *
     * See `ProtonDriveClient.restoreNodes` for more information.
     */
    async *restoreNodes(nodeUids, signal) {
        this.logger.info(`Restoring ${nodeUids.length} nodes`);
        yield* this.nodes.management.restoreNodes((0, transformers_1.getUids)(nodeUids), signal);
    }
    /**
     * Delete the nodes permanently.
     *
     * See `ProtonDriveClient.deleteNodes` for more information.
     */
    async *deleteNodes(nodeUids, signal) {
        this.logger.info(`Deleting ${nodeUids.length} nodes`);
        yield* this.nodes.management.deleteTrashedNodes((0, transformers_1.getUids)(nodeUids), signal);
    }
    /**
     * Empty the trash.
     *
     * See `ProtonDriveClient.emptyTrash` for more information.
     */
    async emptyTrash() {
        this.logger.info('Emptying trash');
        throw new Error('Method not implemented');
    }
    /**
     * Iterates the nodes shared by the user.
     *
     * See `ProtonDriveClient.iterateSharedNodes` for more information.
     */
    async *iterateSharedNodes(signal) {
        this.logger.info('Iterating shared nodes by me');
        yield* (0, transformers_1.convertInternalPhotoNodeIterator)(this.sharing.access.iterateSharedNodes(signal));
    }
    /**
     * Iterates the nodes shared with the user.
     *
     * See `ProtonDriveClient.iterateSharedNodesWithMe` for more information.
     */
    async *iterateSharedNodesWithMe(signal) {
        this.logger.info('Iterating shared nodes with me');
        for await (const node of this.sharing.access.iterateSharedNodesWithMe(signal)) {
            yield (0, transformers_1.convertInternalPhotoNode)(node);
        }
    }
    /**
     * Leave shared node that was previously shared with the user.
     *
     * See `ProtonDriveClient.leaveSharedNode` for more information.
     */
    async leaveSharedNode(nodeUid) {
        this.logger.info(`Leaving shared node with me ${(0, transformers_1.getUid)(nodeUid)}`);
        await this.sharing.access.removeSharedNodeWithMe((0, transformers_1.getUid)(nodeUid));
    }
    /**
     * Iterates the invitations to shared nodes.
     *
     * See `ProtonDriveClient.iterateInvitations` for more information.
     */
    async *iterateInvitations(signal) {
        this.logger.info('Iterating invitations');
        yield* this.sharing.access.iterateInvitations(signal);
    }
    /**
     * Accept the invitation to the shared node.
     *
     * See `ProtonDriveClient.acceptInvitation` for more information.
     */
    async acceptInvitation(invitationUid) {
        this.logger.info(`Accepting invitation ${(0, transformers_1.getUid)(invitationUid)}`);
        await this.sharing.access.acceptInvitation((0, transformers_1.getUid)(invitationUid));
    }
    /**
     * Reject the invitation to the shared node.
     *
     * See `ProtonDriveClient.rejectInvitation` for more information.
     */
    async rejectInvitation(invitationUid) {
        this.logger.info(`Rejecting invitation ${(0, transformers_1.getUid)(invitationUid)}`);
        await this.sharing.access.rejectInvitation((0, transformers_1.getUid)(invitationUid));
    }
    /**
     * Get sharing info of the node.
     *
     * See `ProtonDriveClient.getSharingInfo` for more information.
     */
    async getSharingInfo(nodeUid) {
        this.logger.info(`Getting sharing info for ${(0, transformers_1.getUid)(nodeUid)}`);
        return this.sharing.management.getSharingInfo((0, transformers_1.getUid)(nodeUid));
    }
    /**
     * Share or update sharing of the node.
     *
     * See `ProtonDriveClient.shareNode` for more information.
     */
    async shareNode(nodeUid, settings) {
        this.logger.info(`Sharing node ${(0, transformers_1.getUid)(nodeUid)}`);
        return this.sharing.management.shareNode((0, transformers_1.getUid)(nodeUid), settings);
    }
    /**
     * Unshare the node, completely or partially.
     *
     * See `ProtonDriveClient.unshareNode` for more information.
     */
    async unshareNode(nodeUid, settings) {
        if (!settings) {
            this.logger.info(`Unsharing node ${(0, transformers_1.getUid)(nodeUid)}`);
        }
        else {
            this.logger.info(`Partially unsharing ${(0, transformers_1.getUid)(nodeUid)}`);
        }
        return this.sharing.management.unshareNode((0, transformers_1.getUid)(nodeUid), settings);
    }
    /**
     * Resend the invitation email to shared node.
     *
     * See `ProtonDriveClient.resendInvitation` for more information.
     */
    async resendInvitation(nodeUid, invitationUid) {
        this.logger.info(`Resending invitation ${(0, transformers_1.getUid)(invitationUid)}`);
        return this.sharing.management.resendInvitationEmail((0, transformers_1.getUid)(nodeUid), (0, transformers_1.getUid)(invitationUid));
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
     * Get the file uploader to upload a new file.
     *
     * See `ProtonDriveClient.getFileUploader` for more information.
     */
    async getFileUploader(name, metadata, signal) {
        this.logger.info(`Getting file uploader`);
        const parentFolderUid = await this.nodes.access.getVolumeRootFolder();
        return this.upload.getFileUploader((0, transformers_1.getUid)(parentFolderUid), name, metadata, signal);
    }
    /**
     * Check if the photo is a duplicate.
     *
     * For given photo name, find existing photos with the same name
     * in the timeline and check if the photo content is also the same.
     * Only the same name is not considered as duplicate photo because
     * it is expected that there are photos with the same name (e.g.,
     * date as a name from multiple cameras, or rolling number).
     *
     * The function accepts a callback to generate the SHA1 and it is
     * called only when there is any matching node name hash to avoid
     * computation for every node if its not necessary.
     *
     * @param name - The name of the photo to check for duplicates.
     * @param generateSha1 - A callback to generate the hex string representation of the SHA1 of the photo content.
     * @param signal - An optional abort signal to cancel the operation.
     * @returns True if the photo already exists in the timeline, false otherwise.
     * @deprecated Use `findPhotoDuplicates` instead to get the node UIDs of duplicate photos.
     */
    async isDuplicatePhoto(name, generateSha1, signal) {
        this.logger.info(`Checking if photo is a duplicate`);
        return this.photos.timeline.findPhotoDuplicates(name, generateSha1, signal).then(nodeUids => nodeUids.length !== 0);
    }
    /**
     * Find duplicate photos by name and content.
     *
     * For given photo name, find existing photos with the same name
     * in the timeline and check if the photo content is also the same.
     * Only the same name is not considered as duplicate photo because
     * it is expected that there are photos with the same name (e.g.,
     * date as a name from multiple cameras, or rolling number).
     *
     * The function accepts a callback to generate the SHA1 and it is
     * called only when there is any matching node name hash to avoid
     * computation for every node if its not necessary.
     *
     * @param name - The name of the photo to check for duplicates.
     * @param generateSha1 - A callback to generate the hex string representation of the SHA1 of the photo content.
     * @param signal - An optional abort signal to cancel the operation.
     * @returns An array of node UIDs of duplicate photos. Empty array if no duplicates found.
     */
    async findPhotoDuplicates(name, generateSha1, signal) {
        this.logger.info(`Checking if photo have duplicates`);
        return this.photos.timeline.findPhotoDuplicates(name, generateSha1, signal);
    }
    /**
     * Iterates the albums.
     *
     * The output is not sorted and the order of the nodes is not guaranteed.
     */
    async *iterateAlbums(signal) {
        this.logger.info('Iterating albums');
        // TODO: expose album type
        yield* (0, transformers_1.convertInternalPhotoNodeIterator)(this.photos.albums.iterateAlbums(signal));
    }
}
exports.ProtonDrivePhotosClient = ProtonDrivePhotosClient;
//# sourceMappingURL=protonDrivePhotosClient.js.map