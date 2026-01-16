import { DriveCrypto, PrivateKey, SessionKey, VERIFICATION_STATUS } from '../../crypto';
import { Author, AnonymousUser, ProtonDriveTelemetry, MetricsDecryptionErrorField, MetricVerificationErrorField, ProtonDriveAccount } from '../../interface';
import { EncryptedNode, EncryptedNodeFolderCrypto, DecryptedUnparsedNode, DecryptedNode, DecryptedNodeKeys, EncryptedRevision, DecryptedUnparsedRevision, NodeSigningKeys } from './interface';
export interface NodesCryptoReporter {
    handleClaimedAuthor(node: NodesCryptoReporterNode, field: MetricVerificationErrorField, signatureType: string, verified: VERIFICATION_STATUS, verificationErrors?: Error[], claimedAuthor?: string | AnonymousUser, notAvailableVerificationKeys?: boolean): Promise<Author>;
    reportDecryptionError(node: NodesCryptoReporterNode, field: MetricsDecryptionErrorField, error: unknown): void;
    reportVerificationError(node: NodesCryptoReporterNode, field: MetricVerificationErrorField, verificationErrors?: Error[], claimedAuthor?: string): void;
}
type NodesCryptoReporterNode = {
    uid: string;
    creationTime: Date;
};
/**
 * Provides crypto operations for nodes metadata.
 *
 * The node crypto service is responsible for decrypting and encrypting node
 * metadata. It should export high-level actions only, such as "decrypt node"
 * instead of low-level operations like "decrypt node key". Low-level operations
 * should be kept private to the module.
 *
 * The service owns the logic to switch between old and new crypto model.
 */
export declare class NodesCryptoService {
    protected driveCrypto: DriveCrypto;
    private account;
    private reporter;
    private logger;
    constructor(telemetry: ProtonDriveTelemetry, driveCrypto: DriveCrypto, account: ProtonDriveAccount, reporter: NodesCryptoReporter);
    decryptNode(node: EncryptedNode, parentKey: PrivateKey): Promise<{
        node: DecryptedUnparsedNode;
        keys?: DecryptedNodeKeys;
    }>;
    private decryptKey;
    private decryptName;
    getNameSessionKey(node: {
        encryptedName: string;
    }, parentKey: PrivateKey): Promise<SessionKey>;
    private decryptMembership;
    private decryptHashKey;
    decryptRevision(nodeUid: string, encryptedRevision: EncryptedRevision, nodeKey: PrivateKey): Promise<DecryptedUnparsedRevision>;
    private decryptContentKeyPacket;
    private decryptExtendedAttributes;
    createFolder(parentKeys: {
        key: PrivateKey;
        hashKey: Uint8Array;
    }, signingKeys: NodeSigningKeys, name: string, extendedAttributes?: string): Promise<{
        encryptedCrypto: Omit<EncryptedNodeFolderCrypto, 'signatureEmail' | 'nameSignatureEmail'> & {
            signatureEmail: string | AnonymousUser;
            nameSignatureEmail: string | AnonymousUser;
            armoredNodePassphraseSignature: string;
            encryptedName: string;
            hash: string;
        };
        keys: DecryptedNodeKeys;
    }>;
    encryptNewName(parentKeys: {
        key: PrivateKey;
        hashKey?: Uint8Array;
    }, nodeNameSessionKey: SessionKey, signingKeys: NodeSigningKeys, newName: string): Promise<{
        signatureEmail: string | AnonymousUser;
        armoredNodeName: string;
        hash?: string;
    }>;
    encryptNodeWithNewParent(nodeName: DecryptedNode['name'], keys: {
        passphrase: string;
        passphraseSessionKey: SessionKey;
        nameSessionKey: SessionKey;
    }, parentKeys: {
        key: PrivateKey;
        hashKey: Uint8Array;
    }, signingKeys: NodeSigningKeys): Promise<{
        encryptedName: string;
        hash: string;
        armoredNodePassphrase: string;
        armoredNodePassphraseSignature: string;
        signatureEmail: string | AnonymousUser;
        nameSignatureEmail: string | AnonymousUser;
    }>;
    generateNameHashes(parentHashKey: Uint8Array, names: string[]): Promise<{
        name: string;
        hash: string;
    }[]>;
}
export {};
