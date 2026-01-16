import { ThumbnailType, ProtonDriveTelemetry, ThumbnailResult } from '../../interface';
import { DownloadAPIService } from './apiService';
import { DownloadCryptoService } from './cryptoService';
import { NodesService } from './interface';
export declare class ThumbnailDownloader {
    private nodesService;
    private apiService;
    private cryptoService;
    private logger;
    private batchThumbnailToNodeUids;
    private ongoingDownloads;
    private bufferedThumbnails;
    constructor(telemetry: ProtonDriveTelemetry, nodesService: NodesService, apiService: DownloadAPIService, cryptoService: DownloadCryptoService);
    iterateThumbnails(nodeUids: string[], thumbnailType?: ThumbnailType, signal?: AbortSignal): AsyncGenerator<ThumbnailResult>;
    private iterateThumbnailUids;
    private requestBatchedThumbnailDownloads;
    private iterateThumbnailDownloads;
    private downloadThumbnail;
}
