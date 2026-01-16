"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadTelemetry = void 0;
const errors_1 = require("../../errors");
const telemetry_1 = require("../../telemetry");
const apiService_1 = require("../apiService");
const uids_1 = require("../uids");
class UploadTelemetry {
    telemetry;
    sharesService;
    logger;
    constructor(telemetry, sharesService) {
        this.telemetry = telemetry;
        this.sharesService = sharesService;
        this.telemetry = telemetry;
        this.logger = this.telemetry.getLogger('upload');
        this.sharesService = sharesService;
    }
    getLoggerForRevision(revisionUid) {
        return new telemetry_1.LoggerWithPrefix(this.logger, `revision ${revisionUid}`);
    }
    logBlockVerificationError(retryHelped) {
        this.telemetry.recordMetric({
            eventName: 'blockVerificationError',
            retryHelped,
        });
    }
    async uploadInitFailed(parentFolderUid, error, expectedSize) {
        const { volumeId } = (0, uids_1.splitNodeUid)(parentFolderUid);
        const errorCategory = getErrorCategory(error);
        // No error category means ignored error from telemetry.
        // For example, aborted request.
        if (!errorCategory) {
            return;
        }
        await this.sendTelemetry(volumeId, {
            uploadedSize: 0,
            expectedSize,
            error: errorCategory,
            originalError: error,
        });
    }
    async uploadFailed(revisionUid, error, uploadedSize, expectedSize) {
        const { volumeId } = (0, uids_1.splitNodeRevisionUid)(revisionUid);
        const errorCategory = getErrorCategory(error);
        // No error category means ignored error from telemetry.
        // For example, aborted request.
        if (!errorCategory) {
            return;
        }
        await this.sendTelemetry(volumeId, {
            uploadedSize,
            expectedSize,
            error: errorCategory,
            originalError: error,
        });
    }
    async uploadFinished(revisionUid, uploadedSize) {
        const { volumeId } = (0, uids_1.splitNodeRevisionUid)(revisionUid);
        await this.sendTelemetry(volumeId, {
            uploadedSize,
            expectedSize: uploadedSize,
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
            eventName: 'upload',
            volumeType,
            ...options,
        });
    }
}
exports.UploadTelemetry = UploadTelemetry;
function getErrorCategory(error) {
    if (error instanceof errors_1.ValidationError) {
        return undefined;
    }
    if (error instanceof errors_1.RateLimitedError) {
        return 'rate_limited';
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