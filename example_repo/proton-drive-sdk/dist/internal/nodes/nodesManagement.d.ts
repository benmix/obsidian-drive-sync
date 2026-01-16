import { NodeResult, NodeResultWithNewUid } from '../../interface';
import { NodeAPIServiceBase } from './apiService';
import { NodesCryptoCache } from './cryptoCache';
import { NodesCryptoService } from './cryptoService';
import { DecryptedNode, EncryptedNode } from './interface';
import { NodesAccessBase } from './nodesAccess';
/**
 * Provides high-level actions for managing nodes.
 *
 * The manager is responsible for handling nodes metadata, including
 * API communication, encryption, decryption, and caching.
 *
 * This module uses other modules providing low-level operations, such
 * as API service, cache, crypto service, etc.
 */
export declare abstract class NodesManagementBase<TEncryptedNode extends EncryptedNode = EncryptedNode, TDecryptedNode extends DecryptedNode = DecryptedNode, TNodesCryptoService extends NodesCryptoService = NodesCryptoService> {
    protected apiService: NodeAPIServiceBase<TEncryptedNode>;
    protected cryptoCache: NodesCryptoCache;
    protected cryptoService: NodesCryptoService;
    protected nodesAccess: NodesAccessBase<TEncryptedNode, TDecryptedNode, TNodesCryptoService>;
    constructor(apiService: NodeAPIServiceBase<TEncryptedNode>, cryptoCache: NodesCryptoCache, cryptoService: NodesCryptoService, nodesAccess: NodesAccessBase<TEncryptedNode, TDecryptedNode, TNodesCryptoService>);
    renameNode(nodeUid: string, newName: string, options?: {
        allowRenameRootNode: boolean;
    }): Promise<TDecryptedNode>;
    moveNodes(nodeUids: string[], newParentNodeUid: string, signal?: AbortSignal): AsyncGenerator<NodeResult>;
    emptyTrash(): Promise<void>;
    moveNode(nodeUid: string, newParentUid: string): Promise<TDecryptedNode>;
    copyNodes(nodeUidsOrWithNames: (string | {
        uid: string;
        name: string;
    })[], newParentNodeUid: string, signal?: AbortSignal): AsyncGenerator<NodeResultWithNewUid>;
    copyNode(nodeUid: string, newParentUid: string, name?: string): Promise<TDecryptedNode>;
    trashNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    restoreNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    deleteTrashedNodes(nodeUids: string[], signal?: AbortSignal): AsyncGenerator<NodeResult>;
    createFolder(parentNodeUid: string, folderName: string, modificationTime?: Date): Promise<TDecryptedNode>;
    protected abstract generateNodeFolder(nodeUid: string, parentUid: string, name: string, encryptedCrypto: {
        hash: string;
        encryptedName: string;
        signatureEmail: string | null;
    }): TDecryptedNode;
    protected generateNodeFolderBase(nodeUid: string, parentNodeUid: string, name: string, encryptedCrypto: {
        hash: string;
        encryptedName: string;
        signatureEmail: string | null;
    }): DecryptedNode;
    findAvailableName(parentFolderUid: string, name: string): Promise<string>;
}
export declare class NodesManagement extends NodesManagementBase {
    protected generateNodeFolder(nodeUid: string, parentNodeUid: string, name: string, encryptedCrypto: {
        hash: string;
        encryptedName: string;
        signatureEmail: string | null;
    }): DecryptedNode;
}
