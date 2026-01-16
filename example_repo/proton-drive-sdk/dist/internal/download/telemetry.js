"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadTelemetry = void 0;
const errors_1 = require("../../errors");
const telemetry_1 = require("../../telemetry");
const apiService_1 = require("../apiService");
const uids_1 = require("../uids");
class DownloadTelemetry {
    telemetry;
    sharesService;
    logger;
    constructor(telemetry, sharesService) {
        this.telemetry = telemetry;
        this.sharesService = sharesService;
        this.telemetry = telemetry;
        this.logger = this.telemetry.getLogger('download');
        this.sharesService = sharesService;
    }
    getLoggerForRevision(revisionUid) {
        return new telemetry_1.LoggerWithPrefix(this.logger, `revision ${revisionUid}`);
    }
    async downloadInitFailed(nodeUid, error) {
        const { volumeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const errorCategory = getErrorCategory(error);
        // No error category means ignored error from telemetry.
        // For example, aborted request.
        if (!errorCategory) {
            return;
        }
        await this.sendTelemetry(volumeId, {
            downloadedSize: 0,
            error: errorCategory,
            originalError: error,
        });
    }
    async downloadFailed(revisionUid, error, downloadedSize, claimedFileSize) {
        const { volumeId } = (0, uids_1.splitNodeRevisionUid)(revisionUid);
        const errorCategory = getErrorCategory(error);
        // No error category means ignored error from telemetry.
        // For example, aborted request.
        if (!errorCategory) {
            return;
        }
        await this.sendTelemetry(volumeId, {
            downloadedSize,
            claimedFileSize,
            error: errorCategory,
            originalError: error,
        });
    }
    async downloadFinished(revisionUid, downloadedSize) {
        const { volumeId } = (0, uids_1.splitNodeRevisionUid)(revisionUid);
        await this.sendTelemetry(volumeId, {
            downloadedSize,
            claimedFileSize: downloadedSize,
        });
    }
    async sendTelemetry(volumeId, options) {
        let volumeType;
        try {
            volumeType = await this.sharesService.getVolumeMetricContext(volumeId);
        }
        catch (error) {
            this.logger.error('Failed to get metric volume type', error);
        }
        this.telemetry.recordMetric({
            eventName: 'download',
            volumeType,
            ...options,
        });
    }
}
exports.DownloadTelemetry = DownloadTelemetry;
function getErrorCategory(error) {
    if (error instanceof errors_1.ValidationError) {
        return undefined;
    }
    if (error instanceof errors_1.RateLimitedError) {
        return 'rate_limited';
    }
    if (error instanceof errors_1.DecryptionError) {
        return 'decryption_error';
    }
    if (error instanceof errors_1.IntegrityError) {
        return 'integrity_error';
    }
    if (error instanceof apiService_1.APIHTTPError) {
        if (error.statusCode >= 400 && error.statusCode < 500) {
            return '4xx';
        }
        if (error.statusCode >= 500) {
            return 'server_error';
        }
    }
    if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
            return 'server_error';
        }
        if (error.name === 'OfflineError' ||
            error.name === 'NetworkError' ||
            error.message?.toLowerCase() === 'network error') {
            return 'network_error';
        }
        if (error.name === 'AbortError') {
            return undefined;
        }
    }
    return 'unknown';
}
//# sourceMappingURL=telemetry.js.map