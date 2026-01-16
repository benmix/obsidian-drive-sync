import { DriveCrypto } from '../../crypto';
import { Logger } from '../../interface';
import { PhotosAPIService } from './apiService';
import { PhotosNodesAccess } from './nodes';
import { PhotoSharesManager } from './shares';
/**
 * Provides access to the photo timeline.
 */
export declare class PhotosTimeline {
    private logger;
    private apiService;
    private driveCrypto;
    private photoShares;
    private nodesService;
    constructor(logger: Logger, apiService: PhotosAPIService, driveCrypto: DriveCrypto, photoShares: PhotoSharesManager, nodesService: PhotosNodesAccess);
    iterateTimeline(signal?: AbortSignal): AsyncGenerator<{
        nodeUid: string;
        captureTime: Date;
        tags: number[];
    }>;
    findPhotoDuplicates(name: string, generateSha1: () => Promise<string>, signal?: AbortSignal): Promise<string[]>;
}
