"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtonDriveClient = void 0;
const config_1 = require("./config");
const crypto_1 = require("./crypto");
const featureFlags_1 = require("./featureFlags");
const transformers_1 = require("./transformers");
const telemetry_1 = require("./telemetry");
const apiService_1 = require("./internal/apiService");
const devices_1 = require("./internal/devices");
const download_1 = require("./internal/download");
const events_1 = require("./internal/events");
const nodes_1 = require("./internal/nodes");
const sdkEvents_1 = require("./internal/sdkEvents");
const shares_1 = require("./internal/shares");
const sharing_1 = require("./internal/sharing");
const sharingPublic_1 = require("./internal/sharingPublic");
const upload_1 = require("./internal/upload");
const uids_1 = require("./internal/uids");
const protonDrivePublicLinkClient_1 = require("./protonDrivePublicLinkClient");
/**
 * ProtonDriveClient is the main interface for the ProtonDrive SDK.
 *
 * The client provides high-level operations for managing nodes, sharing,
 * and downloading/uploading files. It is the main entry point for using
 * the ProtonDrive SDK.
 */
class ProtonDriveClient {
    logger;
    sdkEvents;
    events;
    shares;
    nodes;
    sharing;
    download;
    upload;
    devices;
    publicSessionManager;
    experimental;
    constructor({ httpClient, entitiesCache, cryptoCache, account, openPGPCryptoModule, srpModule, config, telemetry, featureFlagProvider, latestEventIdProvider, }) {
        if (!telemetry) {
            telemetry = new telemetry_1.Telemetry();
        }
        if (!featureFlagProvider) {
            featureFlagProvider = new featureFlags_1.NullFeatureFlagProvider();
        }
        this.logger = telemetry.getLogger('interface');
        const fullConfig = (0, config_1.getConfig)(config);
        this.sdkEvents = new sdkEvents_1.SDKEvents(telemetry);
        const cryptoModule = new crypto_1.DriveCrypto(openPGPCryptoModule, srpModule);
        const apiService = new apiService_1.DriveAPIService(telemetry, this.sdkEvents, httpClient, fullConfig.baseUrl, fullConfig.language);
        this.shares = (0, shares_1.initSharesModule)(telemetry, apiService, entitiesCache, cryptoCache, account, cryptoModule);
        this.nodes = (0, nodes_1.initNodesModule)(telemetry, apiService, entitiesCache, cryptoCache, account, cryptoModule, this.shares, fullConfig.clientUid);
        this.sharing = (0, sharing_1.initSharingModule)(telemetry, apiService, entitiesCache, account, cryptoModule, this.shares, this.nodes.access);
        this.download = (0, download_1.initDownloadModule)(telemetry, apiService, cryptoModule, account, this.shares, this.nodes.access, this.nodes.revisions);
        this.upload = (0, upload_1.initUploadModule)(telemetry, apiService, cryptoModule, this.shares, this.nodes.access, fullConfig.clientUid);
        this.devices = (0, devices_1.initDevicesModule)(telemetry, apiService, cryptoModule, this.shares, this.nodes.access, this.nodes.management);
        // These are used to keep the internal cache up to date
        const cacheEventListeners = [
            this.nodes.eventHandler.updateNodesCacheOnEvent.bind(this.nodes.eventHandler),
            this.sharing.eventHandler.handleDriveEvent.bind(this.sharing.eventHandler),
        ];
        this.events = new events_1.DriveEventsService(telemetry, apiService, this.shares, cacheEventListeners, latestEventIdProvider);
        this.publicSessionManager = new sharingPublic_1.SharingPublicSessionManager(telemetry, httpClient, cryptoModule, srpModule, apiService);
        this.experimental = {
            getNodeUrl: async (nodeUid) => {
                this.logger.debug(`Getting node URL for ${(0, transformers_1.getUid)(nodeUid)}`);
                return this.nodes.access.getNodeUrl((0, transformers_1.getUid)(nodeUid));
            },
            getDocsKey: async (nodeUid) => {
                this.logger.debug(`Getting docs keys for ${(0, transformers_1.getUid)(nodeUid)}`);
                const keys = await this.nodes.access.getNodeKeys((0, transformers_1.getUid)(nodeUid));
                if (!keys.contentKeyPacketSessionKey) {
                    throw new Error('Node does not have a content key packet session key');
                }
                return keys.contentKeyPacketSessionKey;
            },
            getPublicLinkInfo: async (url) => {
                this.logger.info(`Getting info for public link ${url}`);
                return this.publicSessionManager.getInfo(url);
            },
            authPublicLink: async (url, customPassword, isAnonymousContext = false) => {
                this.logger.info(`Authenticating public link ${url}`);
                const { httpClient, token, shareKey, rootUid, publicRole } = await this.publicSessionManager.auth(url, customPassword);
                return new protonDrivePublicLinkClient_1.ProtonDrivePublicLinkClient({
                    httpClient,
                    account,
                    openPGPCryptoModule,
                    srpModule,
                    config,
                    telemetry,
                    url,
                    token,
                    publicShareKey: shareKey,
                    publicRootNodeUid: rootUid,
                    isAnonymousContext,
                    publicRole,
                });
            },
        };
    }
    /**
     * Subscribes to the general SDK events.
     *
     * This is not connected to the remote data updates. For that, use
     * and see `subscribeToRemoteDataUpdates`.
     *
     * @param eventName - SDK event name.
     * @param callback - Callback to be called when the event is emitted.
     * @returns Callback to unsubscribe from the event.
     */
    onMessage(eventName, callback) {
        this.logger.debug(`Subscribing to event ${eventName}`);
        return this.sdkEvents.addListener(eventName, callback);
    }
    /**
     * Subscribes to the remote data updates for all files and folders in a
     * tree.
     *
     * In order to keep local data up to date, the client must call this method
     * to receive events on update and to keep the SDK cache in sync.
     *
     * The `treeEventScopeId` can be obtained from node properties.
     *
     * Only one instance of the SDK should subscribe to updates.
     */
    async subscribeToTreeEvents(treeEventScopeId, callback) {
        this.logger.debug('Subscribing to node updates');
        return this.events.subscribeToTreeEvents(treeEventScopeId, callback);
    }
    /**
     * Subscribes to the remote general data updates.
     *
     * Only one instance of the SDK should subscribe to updates.
     */
    async subscribeToDriveEvents(callback) {
        this.logger.debug('Subscribing to core updates');
        return this.events.subscribeToCoreEvents(callback);
    }
    /**
     * Provides the node UID for the given raw share and node IDs.
     *
     * This is required only for the internal implementation to provide
     * backward compatibility with the old Drive web setup.
     *
     * If you are having volume ID, use `generateNodeUid` instead.
     *
     * @deprecated This method is not part of the public API.
     * @param shareId - Context share of the node.
     * @param nodeId - Node/link ID (not UID).
     * @returns The node UID.
     */
    async getNodeUid(shareId, nodeId) {
        this.logger.info(`Getting node UID for share ${shareId} and node ${nodeId}`);
        const share = await this.shares.loadEncryptedShare(shareId);
        return (0, uids_1.makeNodeUid)(share.volumeId, nodeId);
    }
    /**
     * @returns The root folder to My files section of the user.
     */
    async getMyFilesRootFolder() {
        this.logger.info('Getting my files root folder');
        return (0, transformers_1.convertInternalNodePromise)(this.nodes.access.getVolumeRootFolder());
    }
    /**
     * Iterates the children of the given parent node.
     *
     * The output is not sorted and the order of the children is not guaranteed.
     *
     * @param parentNodeUid - Node entity or its UID string.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the children of the given parent node.
     */
    async *iterateFolderChildren(parentNodeUid, filterOptions, signal) {
        this.logger.info(`Iterating children of ${(0, transformers_1.getUid)(parentNodeUid)}`);
        const iterator = this.nodes.access.iterateFolderChildren((0, transformers_1.getUid)(parentNodeUid), filterOptions, signal);
        yield* (0, transformers_1.convertInternalNodeIterator)(iterator);
    }
    /**
     * Iterates the trashed nodes.
     *
     * The list of trashed nodes is not cached and is fetched from the server
     * on each call. The node data itself are served from cached if available.
     *
     * The output is not sorted and the order of the trashed nodes is not guaranteed.
     *
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the trashed nodes.
     */
    async *iterateTrashedNodes(signal) {
        this.logger.info('Iterating trashed nodes');
        yield* (0, transformers_1.convertInternalNodeIterator)(this.nodes.access.iterateTrashedNodes(signal));
    }
    /**
     * Iterates the nodes by their UIDs.
     *
     * The output is not sorted and the order of the nodes is not guaranteed.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the nodes.
     */
    async *iterateNodes(nodeUids, signal) {
        this.logger.info(`Iterating ${nodeUids.length} nodes`);
        yield* (0, transformers_1.convertInternalMissingNodeIterator)(this.nodes.access.iterateNodes((0, transformers_1.getUids)(nodeUids), signal));
    }
    /**
     * Get the node by its UID.
     *
     * @param nodeUid - Node entity or its UID string.
     * @returns The node entity.
     */
    async getNode(nodeUid) {
        this.logger.info(`Getting node ${(0, transformers_1.getUid)(nodeUid)}`);
        return (0, transformers_1.convertInternalNodePromise)(this.nodes.access.getNode((0, transformers_1.getUid)(nodeUid)));
    }
    /**
     * Rename the node.
     *
     * @param nodeUid - Node entity or its UID string.
     * @returns The updated node entity.
     * @throws {@link ValidationError} If the name is empty, too long, or contains a slash.
     * @throws {@link ValidationError} If another node with the same name already exists.
     */
    async renameNode(nodeUid, newName) {
        this.logger.info(`Renaming node ${(0, transformers_1.getUid)(nodeUid)}`);
        return (0, transformers_1.convertInternalNodePromise)(this.nodes.management.renameNode((0, transformers_1.getUid)(nodeUid), newName));
    }
    /**
     * Move the nodes to a new parent node.
     *
     * The operation is performed node by node and the results are yielded
     * as they are available. Order of the results is not guaranteed.
     *
     * If one of the nodes fails to move, the operation continues with the
     * rest of the nodes. Use `NodeResult` to check the status of the action.
     *
     * Only move withing the same section is supported at this moment.
     * That means that the new parent node must be in the same section
     * as the nodes being moved. E.g., moving from My files to Shared with
     * me is not supported yet.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param newParentNodeUid - Node entity or its UID string.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the results of the move operation
     */
    async *moveNodes(nodeUids, newParentNodeUid, signal) {
        this.logger.info(`Moving ${nodeUids.length} nodes to ${(0, transformers_1.getUid)(newParentNodeUid)}`);
        yield* this.nodes.management.moveNodes((0, transformers_1.getUids)(nodeUids), (0, transformers_1.getUid)(newParentNodeUid), signal);
    }
    /**
     * Copy the nodes to a new parent node.
     *
     * The operation is performed node by node and the results are yielded
     * as they are available. Order of the results is not guaranteed.
     *
     * The `nodeUids` can be a list of node entities or their UIDs, or a list
     * of objects with `uid` and `name` properties where the name is the new
     * name of the copied node. By default, the name is the same as the
     * original node. Use `getAvailableName` to get the available name for the
     * new node in the target parent node in case of a name conflict.
     *
     * If one of the nodes fails to copy, the operation continues with the
     * rest of the nodes. Use `NodeResult` to check the status of the action.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param newParentNodeUid - Node entity or its UID string.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the results of the copy operation
     */
    async *copyNodes(nodesOrNodeUidsOrWithNames, newParentNodeUid, signal) {
        this.logger.info(`Copying ${nodesOrNodeUidsOrWithNames.length} nodes to ${(0, transformers_1.getUid)(newParentNodeUid)}`);
        const nodeUidsOrWithNames = nodesOrNodeUidsOrWithNames.map((param) => {
            if (typeof param === 'string') {
                return param;
            }
            if ('uid' in param && 'name' in param && typeof param.uid === 'string' && typeof param.name === 'string') {
                return { uid: param.uid, name: param.name };
            }
            return (0, transformers_1.getUid)(param);
        });
        yield* this.nodes.management.copyNodes(nodeUidsOrWithNames, (0, transformers_1.getUid)(newParentNodeUid), signal);
    }
    /**
     * Trash the nodes.
     *
     * The operation is performed in batches and the results are yielded
     * as they are available. Order of the results is not guaranteed.
     *
     * If one of the nodes fails to trash, the operation continues with the
     * rest of the nodes. Use `NodeResult` to check the status of the action.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the results of the trash operation
     */
    async *trashNodes(nodeUids, signal) {
        this.logger.info(`Trashing ${nodeUids.length} nodes`);
        yield* this.nodes.management.trashNodes((0, transformers_1.getUids)(nodeUids), signal);
    }
    /**
     * Restore the nodes from the trash to their original place.
     *
     * The operation is performed in batches and the results are yielded
     * as they are available. Order of the results is not guaranteed.
     *
     * If one of the nodes fails to restore, the operation continues with the
     * rest of the nodes. Use `NodeResult` to check the status of the action.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the results of the restore operation
     */
    async *restoreNodes(nodeUids, signal) {
        this.logger.info(`Restoring ${nodeUids.length} nodes`);
        yield* this.nodes.management.restoreNodes((0, transformers_1.getUids)(nodeUids), signal);
    }
    /**
     * Delete the trashed nodes permanently. Only the owner can do that.
     *
     * The operation is performed in batches and the results are yielded
     * as they are available. Order of the results is not guaranteed.
     *
     * If one of the nodes fails to delete, the operation continues with the
     * rest of the nodes. Use `NodeResult` to check the status of the action.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the results of the delete operation
     */
    async *deleteNodes(nodeUids, signal) {
        this.logger.info(`Deleting ${nodeUids.length} nodes`);
        yield* this.nodes.management.deleteTrashedNodes((0, transformers_1.getUids)(nodeUids), signal);
    }
    async emptyTrash() {
        this.logger.info('Emptying trash');
        return this.nodes.management.emptyTrash();
    }
    /**
     * Create a new folder.
     *
     * The folder is created in the given parent node.
     *
     * @param parentNodeUid - Node entity or its UID string of the parent folder.
     * @param name - Name of the new folder.
     * @param modificationTime - Optional modification time of the folder.
     * @returns The created node entity.
     * @throws {@link Error} If the parent node is not a folder.
     * @throws {@link ValidationError} If the name is empty, too long, or contains a slash.
     * @throws {@link Error} If another node with the same name already exists.
     */
    async createFolder(parentNodeUid, name, modificationTime) {
        this.logger.info(`Creating folder in ${(0, transformers_1.getUid)(parentNodeUid)}`);
        return (0, transformers_1.convertInternalNodePromise)(this.nodes.management.createFolder((0, transformers_1.getUid)(parentNodeUid), name, modificationTime));
    }
    /**
     * Iterates the revisions of given node.
     *
     * The list of node revisions is not cached and is fetched and decrypted
     * from the server on each call.
     *
     * The output is sorted by the revision date in descending order (newest
     * first).
     *
     * @param nodeUid - Node entity or its UID string.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the node revisions.
     */
    async *iterateRevisions(nodeUid, signal) {
        this.logger.info(`Iterating revisions of ${(0, transformers_1.getUid)(nodeUid)}`);
        yield* (0, transformers_1.convertInternalRevisionIterator)(this.nodes.revisions.iterateRevisions((0, transformers_1.getUid)(nodeUid), signal));
    }
    /**
     * Restore the node to the given revision.
     *
     * Warning: Restoring revisions might be accepted by the server but not
     * applied. If the client re-loads list of revisions quickly after the
     * restore, the change might not be visible. Update the UI optimistically to
     * reflect the change.
     *
     * @param revisionUid - UID of the revision to restore.
     */
    async restoreRevision(revisionUid) {
        this.logger.info(`Restoring revision ${(0, transformers_1.getUid)(revisionUid)}`);
        await this.nodes.revisions.restoreRevision((0, transformers_1.getUid)(revisionUid));
    }
    /**
     * Delete the revision.
     *
     * @param revisionUid - UID of the revision to delete.
     */
    async deleteRevision(revisionUid) {
        this.logger.info(`Deleting revision ${(0, transformers_1.getUid)(revisionUid)}`);
        await this.nodes.revisions.deleteRevision((0, transformers_1.getUid)(revisionUid));
    }
    /**
     * Iterates the nodes shared by the user.
     *
     * The output is not sorted and the order of the shared nodes is not guaranteed.
     *
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the shared nodes.
     */
    async *iterateSharedNodes(signal) {
        this.logger.info('Iterating shared nodes by me');
        yield* (0, transformers_1.convertInternalNodeIterator)(this.sharing.access.iterateSharedNodes(signal));
    }
    /**
     * Iterates the nodes shared with the user.
     *
     * The output is not sorted and the order of the shared nodes is not guaranteed.
     *
     * Clients can subscribe to drive events in order to receive a
     * `SharedWithMeUpdated` event when there are changes to the user's
     * access to shared nodes.
     *
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the shared nodes.
     */
    async *iterateSharedNodesWithMe(signal) {
        this.logger.info('Iterating shared nodes with me');
        for await (const node of this.sharing.access.iterateSharedNodesWithMe(signal)) {
            yield (0, transformers_1.convertInternalNode)(node);
        }
    }
    /**
     * Leave shared node that was previously shared with the user.
     *
     * @param nodeUid - Node entity or its UID string.
     */
    async leaveSharedNode(nodeUid) {
        this.logger.info(`Leaving shared node with me ${(0, transformers_1.getUid)(nodeUid)}`);
        await this.sharing.access.removeSharedNodeWithMe((0, transformers_1.getUid)(nodeUid));
    }
    /**
     * Iterates the invitations to shared nodes.
     *
     * The output is not sorted and the order of the invitations is not guaranteed.
     *
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the invitations.
     */
    async *iterateInvitations(signal) {
        this.logger.info('Iterating invitations');
        yield* this.sharing.access.iterateInvitations(signal);
    }
    /**
     * Accept the invitation to the shared node.
     *
     * @param invitationUid - Invitation entity or its UID string.
     */
    async acceptInvitation(invitationUid) {
        this.logger.info(`Accepting invitation ${(0, transformers_1.getUid)(invitationUid)}`);
        await this.sharing.access.acceptInvitation((0, transformers_1.getUid)(invitationUid));
    }
    /**
     * Reject the invitation to the shared node.
     *
     * @param invitationOrUid - Invitation entity or its UID string.
     */
    async rejectInvitation(invitationUid) {
        this.logger.info(`Rejecting invitation ${(0, transformers_1.getUid)(invitationUid)}`);
        await this.sharing.access.rejectInvitation((0, transformers_1.getUid)(invitationUid));
    }
    /**
     * Iterates the shared bookmarks.
     *
     * The output is not sorted and the order of the bookmarks is not guaranteed.
     *
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the shared bookmarks.
     */
    async *iterateBookmarks(signal) {
        this.logger.info('Iterating shared bookmarks');
        yield* this.sharing.access.iterateBookmarks(signal);
    }
    /**
     * Remove the shared bookmark.
     *
     * @param bookmarkOrUid - Bookmark entity or its UID string.
     */
    async removeBookmark(bookmarkOrUid) {
        this.logger.info(`Removing bookmark ${(0, transformers_1.getUid)(bookmarkOrUid)}`);
        await this.sharing.access.deleteBookmark((0, transformers_1.getUid)(bookmarkOrUid));
    }
    /**
     * Get sharing info of the node.
     *
     * The sharing info contains the list of invitations, members,
     * public link and permission for each.
     *
     * The sharing info is not cached and is fetched from the server
     * on each call.
     *
     * @param nodeUid - Node entity or its UID string.
     * @returns The sharing info of the node. Undefined if not shared.
     */
    async getSharingInfo(nodeUid) {
        this.logger.info(`Getting sharing info for ${(0, transformers_1.getUid)(nodeUid)}`);
        return this.sharing.management.getSharingInfo((0, transformers_1.getUid)(nodeUid));
    }
    /**
     * Share or update sharing of the node.
     *
     * If the node is already shared, the sharing settings are updated.
     * If the member is already present but with different role, the role
     * is updated. If the sharing settings is identical, the sharing info
     * is returned without any change.
     *
     * @param nodeUid - Node entity or its UID string.
     * @param settings - Settings for sharing the node.
     * @returns The updated sharing info of the node.
     */
    async shareNode(nodeUid, settings) {
        this.logger.info(`Sharing node ${(0, transformers_1.getUid)(nodeUid)}`);
        return this.sharing.management.shareNode((0, transformers_1.getUid)(nodeUid), settings);
    }
    /**
     * Unshare the node, completely or partially.
     *
     * @param nodeUid - Node entity or its UID string.
     * @param settings - Settings for unsharing the node. If not provided, the node
     *                   is unshared completely.
     * @returns The updated sharing info of the node. Undefined if unshared completely.
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
     * @param nodeUid - Node entity or its UID string.
     * @param invitationUid - Invitation entity or its UID string.
     */
    async resendInvitation(nodeUid, invitationUid) {
        this.logger.info(`Resending invitation ${(0, transformers_1.getUid)(invitationUid)}`);
        return this.sharing.management.resendInvitationEmail((0, transformers_1.getUid)(nodeUid), (0, transformers_1.getUid)(invitationUid));
    }
    /**
     * Get the file downloader to download the node content of the active
     * revision. For downloading specific revision of the file, use
     * `getFileRevisionDownloader`.
     *
     * The number of ongoing downloads is limited. If the limit is reached,
     * the download is queued and started when the slot is available. It is
     * recommended to not start too many downloads at once to avoid having
     * many open promises.
     *
     * The file downloader is not reusable. If the download is interrupted,
     * a new file downloader must be created.
     *
     * Before download, the authorship of the node should be checked and
     * reported to the user if there is any signature issue, notably on the
     * content author on the revision.
     *
     * Client should not automatically retry the download if it fails. The
     * download should be initiated by the user again. The downloader does
     * automatically retry the download if it fails due to network issues,
     * or if the server is temporarily unavailable.
     *
     * Once download is initiated, the download can fail, besides network
     * issues etc., only when there is integrity error. It should be considered
     * a bug and reported to the Drive developers. The SDK provides option
     * to bypass integrity checks, but that should be used only for debugging
     * purposes, not available to the end users.
     *
     * Example usage:
     *
     * ```typescript
     * const downloader = await client.getFileDownloader(nodeUid, signal);
     * const claimedSize = fileDownloader.getClaimedSizeInBytes();
     * const downloadController = fileDownloader.downloadToStream(stream, (downloadedBytes) => { ... });
     *
     * signalController.abort(); // to cancel
     * downloadController.pause(); // to pause
     * downloadController.resume(); // to resume
     * await downloadController.completion(); // to await completion
     * ```
     */
    async getFileDownloader(nodeUid, signal) {
        this.logger.info(`Getting file downloader for ${(0, transformers_1.getUid)(nodeUid)}`);
        return this.download.getFileDownloader((0, transformers_1.getUid)(nodeUid), signal);
    }
    /**
     * Same as `getFileDownloader`, but for a specific revision of the file.
     */
    async getFileRevisionDownloader(nodeRevisionUid, signal) {
        this.logger.info(`Getting file revision downloader for ${(0, transformers_1.getUid)(nodeRevisionUid)}`);
        return this.download.getFileRevisionDownloader(nodeRevisionUid, signal);
    }
    /**
     * Iterates the thumbnails of the given nodes.
     *
     * The output is not sorted and the order of the nodes is not guaranteed.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param thumbnailType - Type of the thumbnail to download.
     * @returns An async generator of the results of the restore operation
     */
    async *iterateThumbnails(nodeUids, thumbnailType, signal) {
        this.logger.info(`Iterating ${nodeUids.length} thumbnails`);
        yield* this.download.iterateThumbnails((0, transformers_1.getUids)(nodeUids), thumbnailType, signal);
    }
    /**
     * Get the file uploader to upload a new file. For uploading a new
     * revision, use `getFileRevisionUploader` instead.
     *
     * The number of ongoing uploads is limited. If the limit is reached,
     * the upload is queued and started when the slot is available. It is
     * recommended to not start too many uploads at once to avoid having
     * many open promises.
     *
     * The file uploader is not reusable. If the upload is interrupted,
     * a new file uploader must be created.
     *
     * Client should not automatically retry the upload if it fails. The
     * upload should be initiated by the user again. The uploader does
     * automatically retry the upload if it fails due to network issues,
     * or if the server is temporarily unavailable.
     *
     * Example usage:
     *
     * ```typescript
     * const uploader = await client.getFileUploader(parentFolderUid, name, metadata, signal);
     * const uploadController = await uploader.uploadFromStream(stream, thumbnails, (uploadedBytes) => { ... });
     *
     * signalController.abort(); // to cancel
     * uploadController.pause(); // to pause
     * uploadController.resume(); // to resume
     * const { nodeUid, nodeRevisionUid } = await uploadController.completion(); // to await completion
     * ```
     */
    async getFileUploader(parentFolderUid, name, metadata, signal) {
        this.logger.info(`Getting file uploader for parent ${(0, transformers_1.getUid)(parentFolderUid)}`);
        return this.upload.getFileUploader((0, transformers_1.getUid)(parentFolderUid), name, metadata, signal);
    }
    /**
     * Same as `getFileUploader`, but for a uploading new revision of the file.
     */
    async getFileRevisionUploader(nodeUid, metadata, signal) {
        this.logger.info(`Getting file revision uploader for ${(0, transformers_1.getUid)(nodeUid)}`);
        return this.upload.getFileRevisionUploader((0, transformers_1.getUid)(nodeUid), metadata, signal);
    }
    /**
     * Returns the available name for the file in the given parent folder.
     *
     * The function will return a name that includes the original name with the
     * available index. The name is guaranteed to be unique in the parent folder.
     *
     * Example new name: `file (2).txt`.
     */
    async getAvailableName(parentFolderUid, name) {
        this.logger.info(`Getting available name in folder ${(0, transformers_1.getUid)(parentFolderUid)}`);
        return this.nodes.management.findAvailableName((0, transformers_1.getUid)(parentFolderUid), name);
    }
    /**
     * Iterates the devices of the user.
     *
     * The output is not sorted and the order of the devices is not guaranteed.
     *
     * New devices can be registered by listening to events in the
     * event scope of "My Files" and filtering on nodes with null `ParentLinkId`.
     *
     * @returns An async generator of devices.
     */
    async *iterateDevices(signal) {
        this.logger.info('Iterating devices');
        yield* this.devices.iterateDevices(signal);
    }
    /**
     * Creates a new device.
     *
     * @param nodeUid - Device entity or its UID string.
     * @returns The created device entity.
     * @throws {@link ValidationError} If the name is empty, too long, or contains a slash.
     */
    async createDevice(name, deviceType) {
        this.logger.info(`Creating device of type ${deviceType}`);
        return this.devices.createDevice(name, deviceType);
    }
    /**
     * Renames a device.
     *
     * @param deviceOrUid - Device entity or its UID string.
     * @returns The updated device entity.
     * @throws {@link ValidationError} If the name is empty, too long, or contains a slash.
     */
    async renameDevice(deviceOrUid, name) {
        this.logger.info(`Renaming device ${(0, transformers_1.getUid)(deviceOrUid)}`);
        return this.devices.renameDevice((0, transformers_1.getUid)(deviceOrUid), name);
    }
    /**
     * Deletes a device.
     *
     * @param deviceOrUid - Device entity or its UID string.
     */
    async deleteDevice(deviceOrUid) {
        this.logger.info(`Deleting device ${(0, transformers_1.getUid)(deviceOrUid)}`);
        await this.devices.deleteDevice((0, transformers_1.getUid)(deviceOrUid));
    }
}
exports.ProtonDriveClient = ProtonDriveClient;
//# sourceMappingURL=protonDriveClient.js.map