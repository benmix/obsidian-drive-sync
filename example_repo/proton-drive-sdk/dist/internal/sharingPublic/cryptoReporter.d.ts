import { VERIFICATION_STATUS } from '../../crypto';
import { Author, ProtonDriveTelemetry, MetricVerificationErrorField, MetricsDecryptionErrorField } from '../../interface';
export declare class SharingPublicCryptoReporter {
    private logger;
    private telemetry;
    constructor(telemetry: ProtonDriveTelemetry);
    handleClaimedAuthor(node: {
        uid: string;
        creationTime: Date;
    }, field: MetricVerificationErrorField, signatureType: string, verified: VERIFICATION_STATUS, verificationErrors?: Error[], claimedAuthor?: string, notAvailableVerificationKeys?: boolean): Promise<Author>;
    reportDecryptionError(node: {
        uid: string;
        creationTime: Date;
    }, field: MetricsDecryptionErrorField, error: unknown): void;
    reportVerificationError(): void;
}
