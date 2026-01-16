import { PrivateKey } from '../../crypto';
import { DecryptionError } from '../../errors';
import { drivePaths } from '../apiService';
import { NodeAPIServiceBase } from '../nodes/apiService';
import { NodesCacheBase } from '../nodes/cache';
import { NodesCryptoService } from '../nodes/cryptoService';
import { DecryptedNodeKeys } from '../nodes/interface';
import { NodesAccessBase } from '../nodes/nodesAccess';
import { NodesManagementBase } from '../nodes/nodesManagement';
import { EncryptedPhotoNode, DecryptedPhotoNode, DecryptedUnparsedPhotoNode } from './interface';
type PostLoadLinksMetadataResponse = drivePaths['/drive/photos/volumes/{volumeID}/links']['post']['responses']['200']['content']['application/json'];
export declare class PhotosNodesAPIService extends NodeAPIServiceBase<EncryptedPhotoNode, PostLoadLinksMetadataResponse['Links'][0]> {
    protected fetchNodeMetadata(volumeId: string, linkIds: string[], signal?: AbortSignal): Promise<({
        Link: import("../apiService/driveTypes").components["schemas"]["LinkDto"];
        Photo: import("../apiService/driveTypes").components["schemas"]["PhotoFileDto"];
        Sharing: import("../apiService/driveTypes").components["schemas"]["SharingDto"] | null;
        Membership: import("../apiService/driveTypes").components["schemas"]["MembershipDto"] | null;
        Album: null | null;
    } | {
        Link: import("../apiService/driveTypes").components["schemas"]["LinkDto"];
        Album: import("../apiService/driveTypes").components["schemas"]["AlbumDto"];
        Sharing: import("../apiService/driveTypes").components["schemas"]["SharingDto"] | null;
        Membership: import("../apiService/driveTypes").components["schemas"]["MembershipDto"] | null;
        Photo: null | null;
    } | {
        Link: import("../apiService/driveTypes").components["schemas"]["LinkDto"];
        Folder: import("../apiService/driveTypes").components["schemas"]["FolderDto"];
        Sharing: import("../apiService/driveTypes").components["schemas"]["SharingDto"] | null;
        Membership: import("../apiService/driveTypes").components["schemas"]["MembershipDto"] | null;
        Photo: null | null;
        Album: null | null;
    })[]>;
    protected linkToEncryptedNode(volumeId: string, link: PostLoadLinksMetadataResponse['Links'][0], isOwnVolumeId: boolean): EncryptedPhotoNode;
}
export declare class PhotosNodesCache extends NodesCacheBase<DecryptedPhotoNode> {
    serialiseNode(node: DecryptedPhotoNode): string;
    deserialiseNode(nodeData: string): DecryptedPhotoNode;
}
export declare class PhotosNodesAccess extends NodesAccessBase<EncryptedPhotoNode, DecryptedPhotoNode, PhotosNodesCryptoService> {
    getParentKeys(node: Pick<EncryptedPhotoNode, 'uid' | 'parentUid' | 'shareId' | 'photo'>): Promise<Pick<DecryptedNodeKeys, 'key' | 'hashKey'>>;
    protected getDegradedUndecryptableNode(encryptedNode: EncryptedPhotoNode, error: DecryptionError): DecryptedPhotoNode;
    protected parseNode(unparsedNode: DecryptedUnparsedPhotoNode): DecryptedPhotoNode;
}
export declare class PhotosNodesCryptoService extends NodesCryptoService {
    decryptNode(encryptedNode: EncryptedPhotoNode, parentKey: PrivateKey): Promise<{
        node: DecryptedUnparsedPhotoNode;
        keys?: DecryptedNodeKeys;
    }>;
}
export declare class PhotosNodesManagement extends NodesManagementBase<EncryptedPhotoNode, DecryptedPhotoNode, PhotosNodesCryptoService> {
    protected generateNodeFolder(nodeUid: string, parentNodeUid: string, name: string, encryptedCrypto: {
        hash: string;
        encryptedName: string;
        signatureEmail: string | null;
    }): DecryptedPhotoNode;
}
export {};
