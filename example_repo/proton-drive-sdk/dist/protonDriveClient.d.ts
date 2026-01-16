import { SessionKey } from './crypto';
import { ProtonDriveClientContructorParameters, NodeOrUid, MaybeNode, MaybeMissingNode, NodeResult, NodeResultWithNewUid, Revision, RevisionOrUid, ShareNodeSettings, UnshareNodeSettings, ProtonInvitationOrUid, NonProtonInvitationOrUid, ProtonInvitationWithNode, MaybeBookmark, BookmarkOrUid, ShareResult, Device, DeviceType, DeviceOrUid, UploadMetadata, FileDownloader, FileUploader, ThumbnailType, ThumbnailResult, SDKEvent, NodeType, MemberRole } from './interface';
import { DriveListener, EventSubscription } from './internal/events';
import { ProtonDrivePublicLinkClient } from './protonDrivePublicLinkClient';
/**
 * ProtonDriveClient is the main interface for the ProtonDrive SDK.
 *
 * The client provides high-level operations for managing nodes, sharing,
 * and downloading/uploading files. It is the main entry point for using
 * the ProtonDrive SDK.
 */
export declare class ProtonDriveClient {
    private logger;
    private sdkEvents;
    private events;
    private shares;
    private nodes;
    private sharing;
    private download;
    private upload;
    private devices;
    private publicSessionManager;
    experimental: {
        /**
         * Experimental feature to return the URL of the node.
         *
         * Use it when you want to open the node in the ProtonDrive web app.
         *
         * It has hardcoded URLs to open in production client only.
         */
        getNodeUrl: (nodeUid: NodeOrUid) => Promise<string>;
        /**
         * Experimental feature to get the docs key for a node.
         *
         * This is used by Docs app to encrypt and decrypt document updates.
         */
        getDocsKey: (nodeUid: NodeOrUid) => Promise<SessionKey>;
        /**
         * Experimental feature to get the info for a public link
         * required to authenticate the public link.
         */
        getPublicLinkInfo: (url: string) => Promise<{
            isCustomPasswordProtected: boolean;
            isLegacy: boolean;
            vendorType: number;
            directAccess?: {
                nodeUid: string;
                directRole: MemberRole;
                publicRole: MemberRole;
            };
        }>;
        /**
         * Experimental feature to authenticate a public link and
         * return the client for the public link to access it.
         */
        authPublicLink: (url: string, customPassword?: string, isAnonymousContext?: boolean) => Promise<ProtonDrivePublicLinkClient>;
    };
    constructor({ httpClient, entitiesCache, cryptoCache, account, openPGPCryptoModule, srpModule, config, telemetry, featureFlagProvider, latestEventIdProvider, }: ProtonDriveClientContructorParameters);
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
    onMessage(eventName: SDKEvent, callback: () => void): () => void;
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
    subscribeToTreeEvents(treeEventScopeId: string, callback: DriveListener): Promise<EventSubscription>;
    /**
     * Subscribes to the remote general data updates.
     *
     * Only one instance of the SDK should subscribe to updates.
     */
    subscribeToDriveEvents(callback: DriveListener): Promise<EventSubscription>;
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
    getNodeUid(shareId: string, nodeId: string): Promise<string>;
    /**
     * @returns The root folder to My files section of the user.
     */
    getMyFilesRootFolder(): Promise<MaybeNode>;
    /**
     * Iterates the children of the given parent node.
     *
     * The output is not sorted and the order of the children is not guaranteed.
     *
     * @param parentNodeUid - Node entity or its UID string.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the children of the given parent node.
     */
    iterateFolderChildren(parentNodeUid: NodeOrUid, filterOptions?: {
        type?: NodeType;
    }, signal?: AbortSignal): AsyncGenerator<MaybeNode>;
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
    iterateTrashedNodes(signal?: AbortSignal): AsyncGenerator<MaybeNode>;
    /**
     * Iterates the nodes by their UIDs.
     *
     * The output is not sorted and the order of the nodes is not guaranteed.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the nodes.
     */
    iterateNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<MaybeMissingNode>;
    /**
     * Get the node by its UID.
     *
     * @param nodeUid - Node entity or its UID string.
     * @returns The node entity.
     */
    getNode(nodeUid: NodeOrUid): Promise<MaybeNode>;
    /**
     * Rename the node.
     *
     * @param nodeUid - Node entity or its UID string.
     * @returns The updated node entity.
     * @throws {@link ValidationError} If the name is empty, too long, or contains a slash.
     * @throws {@link ValidationError} If another node with the same name already exists.
     */
    renameNode(nodeUid: NodeOrUid, newName: string): Promise<MaybeNode>;
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
    moveNodes(nodeUids: NodeOrUid[], newParentNodeUid: NodeOrUid, signal?: AbortSignal): AsyncGenerator<NodeResult>;
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
    copyNodes(nodesOrNodeUidsOrWithNames: (NodeOrUid | {
        uid: string;
        name: string;
    })[], newParentNodeUid: NodeOrUid, signal?: AbortSignal): AsyncGenerator<NodeResultWithNewUid>;
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
    trashNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
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
    restoreNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
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
    deleteNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    emptyTrash(): Promise<void>;
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
    createFolder(parentNodeUid: NodeOrUid, name: string, modificationTime?: Date): Promise<MaybeNode>;
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
    iterateRevisions(nodeUid: NodeOrUid, signal?: AbortSignal): AsyncGenerator<Revision>;
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
    restoreRevision(revisionUid: RevisionOrUid): Promise<void>;
    /**
     * Delete the revision.
     *
     * @param revisionUid - UID of the revision to delete.
     */
    deleteRevision(revisionUid: RevisionOrUid): Promise<void>;
    /**
     * Iterates the nodes shared by the user.
     *
     * The output is not sorted and the order of the shared nodes is not guaranteed.
     *
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the shared nodes.
     */
    iterateSharedNodes(signal?: AbortSignal): AsyncGenerator<MaybeNode>;
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
    iterateSharedNodesWithMe(signal?: AbortSignal): AsyncGenerator<MaybeNode>;
    /**
     * Leave shared node that was previously shared with the user.
     *
     * @param nodeUid - Node entity or its UID string.
     */
    leaveSharedNode(nodeUid: NodeOrUid): Promise<void>;
    /**
     * Iterates the invitations to shared nodes.
     *
     * The output is not sorted and the order of the invitations is not guaranteed.
     *
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the invitations.
     */
    iterateInvitations(signal?: AbortSignal): AsyncGenerator<ProtonInvitationWithNode>;
    /**
     * Accept the invitation to the shared node.
     *
     * @param invitationUid - Invitation entity or its UID string.
     */
    acceptInvitation(invitationUid: ProtonInvitationOrUid): Promise<void>;
    /**
     * Reject the invitation to the shared node.
     *
     * @param invitationOrUid - Invitation entity or its UID string.
     */
    rejectInvitation(invitationUid: ProtonInvitationOrUid): Promise<void>;
    /**
     * Iterates the shared bookmarks.
     *
     * The output is not sorted and the order of the bookmarks is not guaranteed.
     *
     * @param signal - Signal to abort the operation.
     * @returns An async generator of the shared bookmarks.
     */
    iterateBookmarks(signal?: AbortSignal): AsyncGenerator<MaybeBookmark>;
    /**
     * Remove the shared bookmark.
     *
     * @param bookmarkOrUid - Bookmark entity or its UID string.
     */
    removeBookmark(bookmarkOrUid: BookmarkOrUid): Promise<void>;
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
    getSharingInfo(nodeUid: NodeOrUid): Promise<ShareResult | undefined>;
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
    shareNode(nodeUid: NodeOrUid, settings: ShareNodeSettings): Promise<ShareResult>;
    /**
     * Unshare the node, completely or partially.
     *
     * @param nodeUid - Node entity or its UID string.
     * @param settings - Settings for unsharing the node. If not provided, the node
     *                   is unshared completely.
     * @returns The updated sharing info of the node. Undefined if unshared completely.
     */
    unshareNode(nodeUid: NodeOrUid, settings?: UnshareNodeSettings): Promise<ShareResult | undefined>;
    /**
     * Resend the invitation email to shared node.
     *
     * @param nodeUid - Node entity or its UID string.
     * @param invitationUid - Invitation entity or its UID string.
     */
    resendInvitation(nodeUid: NodeOrUid, invitationUid: ProtonInvitationOrUid | NonProtonInvitationOrUid): Promise<void>;
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
    getFileDownloader(nodeUid: NodeOrUid, signal?: AbortSignal): Promise<FileDownloader>;
    /**
     * Same as `getFileDownloader`, but for a specific revision of the file.
     */
    getFileRevisionDownloader(nodeRevisionUid: string, signal?: AbortSignal): Promise<FileDownloader>;
    /**
     * Iterates the thumbnails of the given nodes.
     *
     * The output is not sorted and the order of the nodes is not guaranteed.
     *
     * @param nodeUids - List of node entities or their UIDs.
     * @param thumbnailType - Type of the thumbnail to download.
     * @returns An async generator of the results of the restore operation
     */
    iterateThumbnails(nodeUids: NodeOrUid[], thumbnailType?: ThumbnailType, signal?: AbortSignal): AsyncGenerator<ThumbnailResult>;
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
    getFileUploader(parentFolderUid: NodeOrUid, name: string, metadata: UploadMetadata, signal?: AbortSignal): Promise<FileUploader>;
    /**
     * Same as `getFileUploader`, but for a uploading new revision of the file.
     */
    getFileRevisionUploader(nodeUid: NodeOrUid, metadata: UploadMetadata, signal?: AbortSignal): Promise<FileUploader>;
    /**
     * Returns the available name for the file in the given parent folder.
     *
     * The function will return a name that includes the original name with the
     * available index. The name is guaranteed to be unique in the parent folder.
     *
     * Example new name: `file (2).txt`.
     */
    getAvailableName(parentFolderUid: NodeOrUid, name: string): Promise<string>;
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
    iterateDevices(signal?: AbortSignal): AsyncGenerator<Device>;
    /**
     * Creates a new device.
     *
     * @param nodeUid - Device entity or its UID string.
     * @returns The created device entity.
     * @throws {@link ValidationError} If the name is empty, too long, or contains a slash.
     */
    createDevice(name: string, deviceType: DeviceType): Promise<Device>;
    /**
     * Renames a device.
     *
     * @param deviceOrUid - Device entity or its UID string.
     * @returns The updated device entity.
     * @throws {@link ValidationError} If the name is empty, too long, or contains a slash.
     */
    renameDevice(deviceOrUid: DeviceOrUid, name: string): Promise<Device>;
    /**
     * Deletes a device.
     *
     * @param deviceOrUid - Device entity or its UID string.
     */
    deleteDevice(deviceOrUid: DeviceOrUid): Promise<void>;
}
