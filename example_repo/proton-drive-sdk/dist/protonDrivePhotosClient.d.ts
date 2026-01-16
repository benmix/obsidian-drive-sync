import { ProtonDriveClientContructorParameters, NodeOrUid, MaybeMissingPhotoNode, UploadMetadata, FileDownloader, FileUploader, SDKEvent, MaybePhotoNode, ThumbnailType, ThumbnailResult, ShareNodeSettings, ShareResult, UnshareNodeSettings, ProtonInvitationOrUid, NonProtonInvitationOrUid, ProtonInvitationWithNode, NodeResult } from './interface';
import { DriveListener, EventSubscription } from './internal/events';
/**
 * ProtonDrivePhotosClient is the interface to access Photos functionality.
 *
 * The client provides high-level operations for managing photos, albums, sharing,
 * and downloading/uploading photos.
 *
 * @deprecated This is an experimental feature that might change without a warning.
 */
export declare class ProtonDrivePhotosClient {
    private logger;
    private sdkEvents;
    private events;
    private photoShares;
    private nodes;
    private sharing;
    private download;
    private upload;
    private photos;
    experimental: {
        /**
         * Experimental feature to return the URL of the node.
         *
         * See `ProtonDriveClient.experimental.getNodeUrl` for more information.
         */
        getNodeUrl: (nodeUid: NodeOrUid) => Promise<string>;
    };
    constructor({ httpClient, entitiesCache, cryptoCache, account, openPGPCryptoModule, srpModule, config, telemetry, latestEventIdProvider, }: ProtonDriveClientContructorParameters);
    /**
     * Subscribes to the general SDK events.
     *
     * See `ProtonDriveClient.onMessage` for more information.
     */
    onMessage(eventName: SDKEvent, callback: () => void): () => void;
    /**
     * Subscribes to the remote data updates for all files in a tree.
     *
     * See `ProtonDriveClient.subscribeToTreeEvents` for more information.
     */
    subscribeToTreeEvents(treeEventScopeId: string, callback: DriveListener): Promise<EventSubscription>;
    /**
     * Subscribes to the remote general data updates.
     *
     * See `ProtonDriveClient.subscribeToDriveEvents` for more information.
     */
    subscribeToDriveEvents(callback: DriveListener): Promise<EventSubscription>;
    /**
     * @returns The root folder to Photos section of the user.
     */
    getMyPhotosRootFolder(): Promise<MaybePhotoNode>;
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
    iterateTimeline(signal?: AbortSignal): AsyncGenerator<{
        nodeUid: string;
        captureTime: Date;
        tags: number[];
    }>;
    /**
     * Iterates the trashed nodes.
     *
     * See `ProtonDriveClient.iterateTrashedNodes` for more information.
     */
    iterateTrashedNodes(signal?: AbortSignal): AsyncGenerator<MaybePhotoNode>;
    /**
     * Iterates the nodes by their UIDs.
     *
     * See `ProtonDriveClient.iterateNodes` for more information.
     */
    iterateNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<MaybeMissingPhotoNode>;
    /**
     * Get the node by its UID.
     *
     * See `ProtonDriveClient.getNode` for more information.
     */
    getNode(nodeUid: NodeOrUid): Promise<MaybePhotoNode>;
    /**
     * Rename the node.
     *
     * See `ProtonDriveClient.renameNode` for more information.
     */
    renameNode(nodeUid: NodeOrUid, newName: string): Promise<MaybePhotoNode>;
    /**
     * Trash the nodes.
     *
     * See `ProtonDriveClient.trashNodes` for more information.
     */
    trashNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    /**
     * Restore the nodes from the trash to their original place.
     *
     * See `ProtonDriveClient.restoreNodes` for more information.
     */
    restoreNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    /**
     * Delete the nodes permanently.
     *
     * See `ProtonDriveClient.deleteNodes` for more information.
     */
    deleteNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    /**
     * Empty the trash.
     *
     * See `ProtonDriveClient.emptyTrash` for more information.
     */
    emptyTrash(): Promise<void>;
    /**
     * Iterates the nodes shared by the user.
     *
     * See `ProtonDriveClient.iterateSharedNodes` for more information.
     */
    iterateSharedNodes(signal?: AbortSignal): AsyncGenerator<MaybePhotoNode>;
    /**
     * Iterates the nodes shared with the user.
     *
     * See `ProtonDriveClient.iterateSharedNodesWithMe` for more information.
     */
    iterateSharedNodesWithMe(signal?: AbortSignal): AsyncGenerator<MaybePhotoNode>;
    /**
     * Leave shared node that was previously shared with the user.
     *
     * See `ProtonDriveClient.leaveSharedNode` for more information.
     */
    leaveSharedNode(nodeUid: NodeOrUid): Promise<void>;
    /**
     * Iterates the invitations to shared nodes.
     *
     * See `ProtonDriveClient.iterateInvitations` for more information.
     */
    iterateInvitations(signal?: AbortSignal): AsyncGenerator<ProtonInvitationWithNode>;
    /**
     * Accept the invitation to the shared node.
     *
     * See `ProtonDriveClient.acceptInvitation` for more information.
     */
    acceptInvitation(invitationUid: ProtonInvitationOrUid): Promise<void>;
    /**
     * Reject the invitation to the shared node.
     *
     * See `ProtonDriveClient.rejectInvitation` for more information.
     */
    rejectInvitation(invitationUid: ProtonInvitationOrUid): Promise<void>;
    /**
     * Get sharing info of the node.
     *
     * See `ProtonDriveClient.getSharingInfo` for more information.
     */
    getSharingInfo(nodeUid: NodeOrUid): Promise<ShareResult | undefined>;
    /**
     * Share or update sharing of the node.
     *
     * See `ProtonDriveClient.shareNode` for more information.
     */
    shareNode(nodeUid: NodeOrUid, settings: ShareNodeSettings): Promise<ShareResult>;
    /**
     * Unshare the node, completely or partially.
     *
     * See `ProtonDriveClient.unshareNode` for more information.
     */
    unshareNode(nodeUid: NodeOrUid, settings?: UnshareNodeSettings): Promise<ShareResult | undefined>;
    /**
     * Resend the invitation email to shared node.
     *
     * See `ProtonDriveClient.resendInvitation` for more information.
     */
    resendInvitation(nodeUid: NodeOrUid, invitationUid: ProtonInvitationOrUid | NonProtonInvitationOrUid): Promise<void>;
    /**
     * Get the file downloader to download the node content.
     *
     * See `ProtonDriveClient.getFileDownloader` for more information.
     */
    getFileDownloader(nodeUid: NodeOrUid, signal?: AbortSignal): Promise<FileDownloader>;
    /**
     * Iterates the thumbnails of the given nodes.
     *
     * See `ProtonDriveClient.iterateThumbnails` for more information.
     */
    iterateThumbnails(nodeUids: NodeOrUid[], thumbnailType?: ThumbnailType, signal?: AbortSignal): AsyncGenerator<ThumbnailResult>;
    /**
     * Get the file uploader to upload a new file.
     *
     * See `ProtonDriveClient.getFileUploader` for more information.
     */
    getFileUploader(name: string, metadata: UploadMetadata & {
        captureTime?: Date;
        mainPhotoLinkID?: string;
        tags?: (0 | 3 | 1 | 2 | 7 | 4 | 5 | 6 | 8 | 9)[];
    }, signal?: AbortSignal): Promise<FileUploader>;
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
    isDuplicatePhoto(name: string, generateSha1: () => Promise<string>, signal?: AbortSignal): Promise<boolean>;
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
    findPhotoDuplicates(name: string, generateSha1: () => Promise<string>, signal?: AbortSignal): Promise<string[]>;
    /**
     * Iterates the albums.
     *
     * The output is not sorted and the order of the nodes is not guaranteed.
     */
    iterateAlbums(signal?: AbortSignal): AsyncGenerator<MaybePhotoNode>;
}
