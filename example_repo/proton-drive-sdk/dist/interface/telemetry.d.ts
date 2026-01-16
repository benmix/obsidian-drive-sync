export interface Telemetry<MetricEvent> {
    getLogger: (name: string) => Logger;
    recordMetric: (event: MetricEvent) => void;
}
export interface Logger {
    debug(msg: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string, error?: unknown): void;
}
export type MetricEvent = MetricAPIRetrySucceededEvent | MetricDebounceLongWaitEvent | MetricUploadEvent | MetricDownloadEvent | MetricDecryptionErrorEvent | MetricVerificationErrorEvent | MetricBlockVerificationErrorEvent | MetricVolumeEventsSubscriptionsChangedEvent;
export interface MetricAPIRetrySucceededEvent {
    eventName: 'apiRetrySucceeded';
    url: string;
    failedAttempts: number;
}
export interface MetricDebounceLongWaitEvent {
    eventName: 'debounceLongWait';
}
export interface MetricUploadEvent {
    eventName: 'upload';
    volumeType?: MetricVolumeType;
    uploadedSize: number;
    expectedSize: number;
    error?: MetricsUploadErrorType;
    originalError?: unknown;
}
export type MetricsUploadErrorType = 'server_error' | 'network_error' | 'integrity_error' | 'rate_limited' | '4xx' | 'unknown';
export interface MetricDownloadEvent {
    eventName: 'download';
    volumeType?: MetricVolumeType;
    downloadedSize: number;
    claimedFileSize?: number;
    error?: MetricsDownloadErrorType;
    originalError?: unknown;
}
export type MetricsDownloadErrorType = 'server_error' | 'network_error' | 'decryption_error' | 'integrity_error' | 'rate_limited' | '4xx' | 'unknown';
export interface MetricDecryptionErrorEvent {
    eventName: 'decryptionError';
    volumeType?: MetricVolumeType;
    field: MetricsDecryptionErrorField;
    fromBefore2024?: boolean;
    error?: unknown;
    uid: string;
}
export type MetricsDecryptionErrorField = 'shareKey' | 'shareUrlPassword' | 'nodeKey' | 'nodeName' | 'nodeHashKey' | 'nodeExtendedAttributes' | 'nodeContentKey' | 'content';
export interface MetricVerificationErrorEvent {
    eventName: 'verificationError';
    volumeType?: MetricVolumeType;
    field: MetricVerificationErrorField;
    addressMatchingDefaultShare?: boolean;
    fromBefore2024?: boolean;
    error?: unknown;
    uid: string;
}
export type MetricVerificationErrorField = 'shareKey' | 'membershipInviter' | 'membershipInvitee' | 'nodeKey' | 'nodeName' | 'nodeHashKey' | 'nodeExtendedAttributes' | 'nodeContentKey' | 'content';
export interface MetricBlockVerificationErrorEvent {
    eventName: 'blockVerificationError';
    retryHelped: boolean;
}
export interface MetricVolumeEventsSubscriptionsChangedEvent {
    eventName: 'volumeEventsSubscriptionsChanged';
    numberOfVolumeSubscriptions: number;
}
export declare enum MetricVolumeType {
    OwnVolume = "own_volume",
    Shared = "shared",
    SharedPublic = "shared_public"
}
