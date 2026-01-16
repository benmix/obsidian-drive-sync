import { VERIFICATION_STATUS } from '../../crypto';
import { Author, AnonymousUser, ProtonDriveTelemetry, MetricsDecryptionErrorField, MetricVerificationErrorField } from '../../interface';
import { EncryptedNode, SharesService } from './interface';
export declare class NodesCryptoReporter {
    private telemetry;
    private shareService;
    private logger;
    private reportedDecryptionErrors;
    private reportedVerificationErrors;
    constructor(telemetry: ProtonDriveTelemetry, shareService: SharesService);
    handleClaimedAuthor(node: {
        uid: string;
        creationTime: Date;
    }, field: MetricVerificationErrorField, signatureType: string, verified: VERIFICATION_STATUS, verificationErrors?: Error[], claimedAuthor?: string | AnonymousUser, notAvailableVerificationKeys?: boolean): Promise<Author>;
    reportVerificationError(node: {
        uid: string;
        creationTime: Date;
    }, field: MetricVerificationErrorField, verificationErrors?: Error[], claimedAuthor?: string | AnonymousUser): Promise<void>;
    reportDecryptionError(node: EncryptedNode, field: MetricsDecryptionErrorField, error: unknown): Promise<void>;
}
