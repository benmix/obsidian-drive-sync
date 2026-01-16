import { OpenPGPCrypto, PrivateKey, SRPModule, SessionKey } from './crypto';
import { ProtonDriveHTTPClient, ProtonDriveTelemetry, ProtonDriveConfig, NodeOrUid, ProtonDriveAccount, MaybeNode, NodeType, MaybeMissingNode, FileDownloader, ThumbnailType, ThumbnailResult, UploadMetadata, FileUploader, NodeResult, SDKEvent, MemberRole } from './interface';
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
export declare class ProtonDrivePublicLinkClient {
    private logger;
    private sdkEvents;
    private sharingPublic;
    private download;
    private upload;
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
    };
    constructor({ httpClient, account, openPGPCryptoModule, srpModule, config, telemetry, url, token, publicShareKey, publicRootNodeUid, isAnonymousContext, publicRole, }: {
        httpClient: ProtonDriveHTTPClient;
        account: ProtonDriveAccount;
        openPGPCryptoModule: OpenPGPCrypto;
        srpModule: SRPModule;
        config?: ProtonDriveConfig;
        telemetry?: ProtonDriveTelemetry;
        url: string;
        token: string;
        publicShareKey: PrivateKey;
        publicRootNodeUid: string;
        isAnonymousContext: boolean;
        publicRole: MemberRole;
    });
    /**
     * Subscribes to the general SDK events.
     *
     * See `ProtonDriveClient.onMessage` for more information.
     */
    onMessage(eventName: SDKEvent, callback: () => void): () => void;
    /**
     * @returns The root folder to the public link.
     */
    getRootNode(): Promise<MaybeNode>;
    /**
     * Iterates the children of the given parent node.
     *
     * See `ProtonDriveClient.iterateFolderChildren` for more information.
     */
    iterateFolderChildren(parentUid: NodeOrUid, filterOptions?: {
        type?: NodeType;
    }, signal?: AbortSignal): AsyncGenerator<MaybeNode>;
    /**
     * Iterates the nodes by their UIDs.
     *
     * See `ProtonDriveClient.iterateNodes` for more information.
     */
    iterateNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<MaybeMissingNode>;
    /**
     * Get the node by its UID.
     *
     * See `ProtonDriveClient.getNode` for more information.
     */
    getNode(nodeUid: NodeOrUid): Promise<MaybeNode>;
    /**
     * Rename the node.
     *
     * See `ProtonDriveClient.renameNode` for more information.
     */
    renameNode(nodeUid: NodeOrUid, newName: string): Promise<MaybeNode>;
    /**
     * Delete own nodes permanently. It skips the trash and allows to delete
     * only nodes that are owned by the user. For anonymous files, this method
     * allows to delete them only in the same session.
     *
     * See `ProtonDriveClient.deleteNodes` for more information.
     */
    deleteNodes(nodeUids: NodeOrUid[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    /**
     * Create a new folder.
     *
     * See `ProtonDriveClient.createFolder` for more information.
     */
    createFolder(parentNodeUid: NodeOrUid, name: string, modificationTime?: Date): Promise<MaybeNode>;
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
     * Get the file uploader to upload a new file. For uploading a new
     * revision, use `getFileRevisionUploader` instead.
     *
     * See `ProtonDriveClient.getFileUploader` for more information.
     */
    getFileUploader(parentFolderUid: NodeOrUid, name: string, metadata: UploadMetadata, signal?: AbortSignal): Promise<FileUploader>;
    /**
     * Same as `getFileUploader`, but for a uploading new revision of the file.
     *
     * See `ProtonDriveClient.getFileRevisionUploader` for more information.
     */
    getFileRevisionUploader(nodeUid: NodeOrUid, metadata: UploadMetadata, signal?: AbortSignal): Promise<FileUploader>;
}
