import { ProtonDriveTelemetry } from '../../interface';
import { LoggerWithPrefix } from '../../telemetry';
import { SharesService } from './interface';
export declare class DownloadTelemetry {
    private telemetry;
    private sharesService;
    private logger;
    constructor(telemetry: ProtonDriveTelemetry, sharesService: SharesService);
    getLoggerForRevision(revisionUid: string): LoggerWithPrefix;
    downloadInitFailed(nodeUid: string, error: unknown): Promise<void>;
    downloadFailed(revisionUid: string, error: unknown, downloadedSize: number, claimedFileSize?: number): Promise<void>;
    downloadFinished(revisionUid: string, downloadedSize: number): Promise<void>;
    private sendTelemetry;
}
