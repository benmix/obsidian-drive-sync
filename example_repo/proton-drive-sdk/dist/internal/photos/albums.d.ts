import { DecryptedNode } from '../nodes';
import { PhotosAPIService } from './apiService';
import { PhotosNodesAccess } from './nodes';
import { PhotoSharesManager } from './shares';
/**
 * Provides access and high-level actions for managing albums.
 */
export declare class Albums {
    private apiService;
    private photoShares;
    private nodesService;
    constructor(apiService: PhotosAPIService, photoShares: PhotoSharesManager, nodesService: PhotosNodesAccess);
    iterateAlbums(signal?: AbortSignal): AsyncGenerator<DecryptedNode>;
    private iterateNodesAndIgnoreMissingOnes;
}
