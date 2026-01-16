import { Logger } from '../../interface';
import { NodeAPIServiceBase } from './apiService';
import { NodesCryptoService } from './cryptoService';
import { NodesAccess } from './nodesAccess';
import { DecryptedRevision } from './interface';
/**
 * Provides access to revisions metadata.
 */
export declare class NodesRevisons {
    private logger;
    private apiService;
    private cryptoService;
    private nodesAccess;
    constructor(logger: Logger, apiService: NodeAPIServiceBase, cryptoService: NodesCryptoService, nodesAccess: Pick<NodesAccess, 'getNodeKeys'>);
    getRevision(nodeRevisionUid: string): Promise<DecryptedRevision>;
    iterateRevisions(nodeUid: string, signal?: AbortSignal): AsyncGenerator<DecryptedRevision>;
    restoreRevision(nodeRevisionUid: string): Promise<void>;
    deleteRevision(nodeRevisionUid: string): Promise<void>;
}
