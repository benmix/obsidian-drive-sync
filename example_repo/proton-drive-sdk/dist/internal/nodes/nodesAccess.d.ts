import { PrivateKey, SessionKey } from '../../crypto';
import { Logger, MissingNode, ProtonDriveTelemetry } from '../../interface';
import { DecryptionError } from '../../errors';
import { NodeAPIServiceBase } from './apiService';
import { NodesCacheBase } from './cache';
import { NodesCryptoCache } from './cryptoCache';
import { NodesCryptoService } from './cryptoService';
import { NodesDebouncer } from './debouncer';
import { SharesService, EncryptedNode, DecryptedUnparsedNode, DecryptedNode, DecryptedNodeKeys, FilterOptions, NodeSigningKeys } from './interface';
/**
 * Provides access to node metadata.
 *
 * The node access module is responsible for fetching, decrypting and caching
 * nodes metadata.
 */
export declare abstract class NodesAccessBase<TEncryptedNode extends EncryptedNode = EncryptedNode, TDecryptedNode extends DecryptedNode = DecryptedNode, TCryptoService extends NodesCryptoService = NodesCryptoService> {
    protected telemetry: ProtonDriveTelemetry;
    protected apiService: NodeAPIServiceBase<TEncryptedNode>;
    protected cache: NodesCacheBase<TDecryptedNode>;
    protected cryptoCache: NodesCryptoCache;
    protected cryptoService: TCryptoService;
    protected shareService: Pick<SharesService, 'getRootIDs' | 'getSharePrivateKey' | 'getContextShareMemberEmailKey'>;
    protected logger: Logger;
    protected debouncer: NodesDebouncer;
    constructor(telemetry: ProtonDriveTelemetry, apiService: NodeAPIServiceBase<TEncryptedNode>, cache: NodesCacheBase<TDecryptedNode>, cryptoCache: NodesCryptoCache, cryptoService: TCryptoService, shareService: Pick<SharesService, 'getRootIDs' | 'getSharePrivateKey' | 'getContextShareMemberEmailKey'>);
    getVolumeRootFolder(): Promise<TDecryptedNode>;
    getNode(nodeUid: string): Promise<TDecryptedNode>;
    iterateFolderChildren(parentNodeUid: string, filterOptions?: FilterOptions, signal?: AbortSignal): AsyncGenerator<TDecryptedNode>;
    iterateTrashedNodes(signal?: AbortSignal): AsyncGenerator<TDecryptedNode>;
    iterateNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<TDecryptedNode | MissingNode>;
    /**
     * Call to invalidate the folder listing cache. This should be refactored into a clean
     * cache layer once the cache is split off.
     */
    notifyChildCreated(nodeUid: string): Promise<void>;
    /**
     * Call to invalidate the node cache when a node changes. Parent can be set after a move
     * to ensure parent listing of new parent is up to date if cached.
     * This should be refactored into a clean cache layer once the cache is split off.
     */
    notifyNodeChanged(nodeUid: string, newParentUid?: string): Promise<void>;
    /**
     * Call to remove a node from cache. This should be refactored when the cache is split off.
     */
    notifyNodeDeleted(nodeUid: string): Promise<void>;
    private loadNode;
    private loadNodes;
    protected getOwnVolumeId(): Promise<string | undefined>;
    private loadNodesWithMissingReport;
    private decryptNode;
    protected abstract getDegradedUndecryptableNode(encryptedNode: TEncryptedNode, error: DecryptionError): TDecryptedNode;
    protected getDegradedUndecryptableNodeBase(encryptedNode: EncryptedNode, error: DecryptionError): DecryptedNode;
    protected abstract parseNode(unparsedNode: Awaited<ReturnType<TCryptoService['decryptNode']>>['node']): TDecryptedNode;
    getParentKeys(node: Pick<TDecryptedNode, 'uid' | 'parentUid' | 'shareId'>): Promise<Pick<DecryptedNodeKeys, 'key' | 'hashKey'>>;
    getNodeKeys(nodeUid: string): Promise<DecryptedNodeKeys>;
    getNodePrivateAndSessionKeys(nodeUid: string): Promise<{
        key: PrivateKey;
        passphrase: string;
        passphraseSessionKey: SessionKey;
        contentKeyPacketSessionKey?: SessionKey;
        nameSessionKey: SessionKey;
    }>;
    getNodeSigningKeys(uids: {
        nodeUid: string;
        parentNodeUid?: string;
    } | {
        nodeUid?: string;
        parentNodeUid: string;
    }): Promise<NodeSigningKeys>;
    getRootNodeEmailKey(nodeUid: string): Promise<{
        email: string;
        addressId: string;
        addressKey: PrivateKey;
        addressKeyId: string;
    }>;
    getNodeUrl(nodeUid: string): Promise<string>;
    private getRootNode;
}
export declare class NodesAccess extends NodesAccessBase {
    protected getDegradedUndecryptableNode(encryptedNode: EncryptedNode, error: DecryptionError): DecryptedNode;
    protected parseNode(unparsedNode: DecryptedUnparsedNode): DecryptedNode;
}
export declare function parseNode(logger: Logger, unparsedNode: DecryptedUnparsedNode): DecryptedNode;
