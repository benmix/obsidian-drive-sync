import { type Logger, MemberRole, NodeResult, ProtonDriveTelemetry } from '../../interface';
import { NodeAPIService } from '../nodes/apiService';
import { NodesCache } from '../nodes/cache';
import { NodesCryptoCache } from '../nodes/cryptoCache';
import { NodesCryptoService } from '../nodes/cryptoService';
import { NodesAccess } from '../nodes/nodesAccess';
import { NodesManagement } from '../nodes/nodesManagement';
import { SharingPublicSharesManager } from './shares';
import { DecryptedNode, DecryptedNodeKeys, NodeSigningKeys, EncryptedNode } from '../nodes/interface';
import { PrivateKey } from '../../crypto';
import { type DriveAPIService, drivePaths } from '../apiService';
type PostLoadLinksMetadataResponse = drivePaths['/drive/v2/volumes/{volumeID}/links']['post']['responses']['200']['content']['application/json'];
/**
 * Custom API service for public links that handles permission injection.
 *
 * TEMPORARY: This is a workaround for the backend sending DirectPermissions as null
 * for public requests.
 *
 * The service injects publicPermissions into the root node's directRole to ensure
 * correct permission handling throughout the SDK.
 */
export declare class SharingPublicNodesAPIService extends NodeAPIService {
    private publicRootNodeUid;
    private publicRole;
    constructor(logger: Logger, apiService: DriveAPIService, clientUid: string | undefined, publicRootNodeUid: string, publicRole: MemberRole);
    protected linkToEncryptedNode(volumeId: string, link: PostLoadLinksMetadataResponse['Links'][0], isOwnVolumeId: boolean): EncryptedNode;
}
export declare class SharingPublicNodesAccess extends NodesAccess {
    private url;
    private token;
    private publicShareKey;
    private publicRootNodeUid;
    private isAnonymousContext;
    constructor(telemetry: ProtonDriveTelemetry, apiService: NodeAPIService, cache: NodesCache, cryptoCache: NodesCryptoCache, cryptoService: NodesCryptoService, sharesService: SharingPublicSharesManager, url: string, token: string, publicShareKey: PrivateKey, publicRootNodeUid: string, isAnonymousContext: boolean);
    /**
     * Returns undefined for public link context to prevent incorrect volume ownership detection.
     *
     * TEMPORARY: When requesting nodes in public link context, we need to ensure nodes are not
     * incorrectly marked as owned by the user. In public context (especially for anonymous users),
     * there is no "own volume", so we return undefined to prevent the SDK from comparing
     * volumeId === ownVolumeId and incorrectly granting admin permissions.
     * May be fixed by backend later.
     */
    protected getOwnVolumeId(): Promise<undefined>;
    getParentKeys(node: Pick<DecryptedNode, 'uid' | 'parentUid' | 'shareId'>): Promise<Pick<DecryptedNodeKeys, 'key' | 'hashKey'>>;
    getNodeUrl(nodeUid: string): Promise<string>;
    getNodeSigningKeys(uids: {
        nodeUid: string;
        parentNodeUid?: string;
    } | {
        nodeUid?: string;
        parentNodeUid: string;
    }): Promise<NodeSigningKeys>;
}
export declare class SharingPublicNodesManagement extends NodesManagement {
    constructor(apiService: NodeAPIService, cryptoCache: NodesCryptoCache, cryptoService: NodesCryptoService, nodesAccess: SharingPublicNodesAccess);
    deleteMyNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
}
export {};
