import { ProtonDriveTelemetry } from '../../interface';
import { LoggerWithPrefix } from '../../telemetry';
import { SharesService } from './interface';
export declare class UploadTelemetry {
    private telemetry;
    private sharesService;
    private logger;
    constructor(telemetry: ProtonDriveTelemetry, sharesService: SharesService);
    getLoggerForRevision(revisionUid: string): LoggerWithPrefix;
    logBlockVerificationError(retryHelped: boolean): void;
    uploadInitFailed(parentFolderUid: string, error: unknown, expectedSize: number): Promise<void>;
    uploadFailed(revisionUid: string, error: unknown, uploadedSize: number, expectedSize: number): Promise<void>;
    uploadFinished(revisionUid: string, uploadedSize: number): Promise<void>;
    private sendTelemetry;
}
