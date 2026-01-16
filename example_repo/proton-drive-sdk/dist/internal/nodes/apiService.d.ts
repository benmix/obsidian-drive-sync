import { Logger, NodeResult, MemberRole, AnonymousUser } from '../../interface';
import { DriveAPIService, drivePaths } from '../apiService';
import { EncryptedNode, EncryptedRevision, FilterOptions } from './interface';
type PostLoadLinksMetadataResponse = drivePaths['/drive/v2/volumes/{volumeID}/links']['post']['responses']['200']['content']['application/json'];
/**
 * Provides API communication for fetching and manipulating nodes metadata.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
export declare abstract class NodeAPIServiceBase<T extends EncryptedNode = EncryptedNode, TMetadataResponseLink extends {
    Link: {
        LinkID: string;
    };
} = {
    Link: {
        LinkID: string;
    };
}> {
    protected logger: Logger;
    protected apiService: DriveAPIService;
    protected clientUid: string | undefined;
    constructor(logger: Logger, apiService: DriveAPIService, clientUid: string | undefined);
    getNode(nodeUid: string, ownVolumeId: string | undefined, signal?: AbortSignal): Promise<T>;
    iterateNodes(nodeUids: string[], ownVolumeId: string | undefined, filterOptions?: FilterOptions, signal?: AbortSignal): AsyncGenerator<T>;
    protected iterateNodesPerVolume(volumeId: string, nodeIds: string[], isOwnVolumeId: boolean, filterOptions?: FilterOptions, signal?: AbortSignal): AsyncGenerator<T, unknown[]>;
    protected abstract fetchNodeMetadata(volumeId: string, linkIds: string[], signal?: AbortSignal): Promise<TMetadataResponseLink[]>;
    protected abstract linkToEncryptedNode(volumeId: string, link: TMetadataResponseLink, isOwnVolumeId: boolean): T;
    iterateChildrenNodeUids(parentNodeUid: string, onlyFolders?: boolean, signal?: AbortSignal): AsyncGenerator<string>;
    iterateTrashedNodeUids(volumeId: string, signal?: AbortSignal): AsyncGenerator<string>;
    renameNode(nodeUid: string, originalNode: {
        hash?: string;
    }, newNode: {
        encryptedName: string;
        nameSignatureEmail: string | AnonymousUser;
        hash?: string;
    }, signal?: AbortSignal): Promise<void>;
    moveNode(nodeUid: string, oldNode: {
        hash: string;
    }, newNode: {
        parentUid: string;
        armoredNodePassphrase: string;
        armoredNodePassphraseSignature?: string;
        signatureEmail?: string | AnonymousUser;
        encryptedName: string;
        nameSignatureEmail?: string | AnonymousUser;
        hash: string;
        contentHash?: string;
    }, signal?: AbortSignal): Promise<void>;
    copyNode(nodeUid: string, newNode: {
        parentUid: string;
        armoredNodePassphrase: string;
        armoredNodePassphraseSignature?: string;
        signatureEmail?: string | AnonymousUser;
        encryptedName: string;
        nameSignatureEmail?: string | AnonymousUser;
        hash: string;
    }, signal?: AbortSignal): Promise<string>;
    trashNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    emptyTrash(volumeId: string): Promise<void>;
    restoreNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    deleteTrashedNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    deleteMyNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    createFolder(parentUid: string, newNode: {
        armoredKey: string;
        armoredHashKey: string;
        armoredNodePassphrase: string;
        armoredNodePassphraseSignature: string;
        signatureEmail: string | AnonymousUser;
        encryptedName: string;
        hash: string;
        armoredExtendedAttributes?: string;
    }): Promise<string>;
    getRevision(nodeRevisionUid: string, signal?: AbortSignal): Promise<EncryptedRevision>;
    getRevisions(nodeUid: string, signal?: AbortSignal): Promise<EncryptedRevision[]>;
    restoreRevision(nodeRevisionUid: string): Promise<void>;
    deleteRevision(nodeRevisionUid: string): Promise<void>;
    checkAvailableHashes(parentNodeUid: string, hashes: string[]): Promise<{
        availableHashes: string[];
        pendingHashes: {
            hash: string;
            nodeUid: string;
            revisionUid: string;
            clientUid?: string;
        }[];
    }>;
}
export declare class NodeAPIService extends NodeAPIServiceBase {
    constructor(logger: Logger, apiService: DriveAPIService, clientUid: string | undefined);
    protected fetchNodeMetadata(volumeId: string, linkIds: string[], signal?: AbortSignal): Promise<PostLoadLinksMetadataResponse['Links']>;
    protected linkToEncryptedNode(volumeId: string, link: PostLoadLinksMetadataResponse['Links'][0], isOwnVolumeId: boolean): EncryptedNode;
}
export declare function linkToEncryptedNode(logger: Logger, volumeId: string, link: Pick<PostLoadLinksMetadataResponse['Links'][0], 'Link' | 'Membership' | 'Sharing' | 'Folder' | 'File'>, isAdmin: boolean): EncryptedNode;
export declare function linkToEncryptedNodeBaseMetadata(logger: Logger, volumeId: string, link: Pick<PostLoadLinksMetadataResponse['Links'][0], 'Link' | 'Membership' | 'Sharing'>, isAdmin: boolean): {
    baseNodeMetadata: {
        hash: string | undefined;
        encryptedName: string;
        uid: string;
        parentUid: string | undefined;
        type: import("../../interface").NodeType;
        creationTime: Date;
        modificationTime: Date;
        trashTime: Date | undefined;
        shareId: string | undefined;
        isShared: boolean;
        isSharedPublicly: boolean;
        directRole: MemberRole;
        membership: {
            role: MemberRole;
            inviteTime: Date;
        } | undefined;
    };
    baseCryptoNodeMetadata: {
        signatureEmail: string | undefined;
        nameSignatureEmail: string | undefined;
        armoredKey: string;
        armoredNodePassphrase: string;
        armoredNodePassphraseSignature: string;
        membership: {
            inviterEmail: string;
            base64MemberSharePassphraseKeyPacket: string;
            armoredInviterSharePassphraseKeyPacketSignature: string;
            armoredInviteeSharePassphraseSessionKeySignature: string;
        } | undefined;
    };
};
export declare function groupNodeUidsByVolumeAndIteratePerBatch(nodeUids: string[]): Generator<{
    volumeId: string;
    batchNodeIds: string[];
    batchNodeUids: string[];
}>;
export {};
