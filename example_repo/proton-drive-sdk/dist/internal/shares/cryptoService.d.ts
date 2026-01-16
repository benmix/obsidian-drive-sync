import { ProtonDriveAccount, ProtonDriveTelemetry } from '../../interface';
import { DriveCrypto, PrivateKey } from '../../crypto';
import { EncryptedRootShare, DecryptedRootShare, EncryptedShareCrypto, DecryptedShareKey } from './interface';
/**
 * Provides crypto operations for share keys.
 *
 * The share crypto service is responsible for encrypting and decrypting share
 * keys. It should export high-level actions only, such as "decrypt share"
 * instead of low-level operations like "decrypt share passphrase". Low-level
 * operations should be kept private to the module.
 *
 * The service owns the logic to switch between old and new crypto model.
 */
export declare class SharesCryptoService {
    private telemetry;
    private driveCrypto;
    private account;
    private logger;
    private reportedDecryptionErrors;
    private reportedVerificationErrors;
    constructor(telemetry: ProtonDriveTelemetry, driveCrypto: DriveCrypto, account: ProtonDriveAccount);
    generateVolumeBootstrap(addressKey: PrivateKey): Promise<{
        shareKey: {
            encrypted: EncryptedShareCrypto;
            decrypted: DecryptedShareKey;
        };
        rootNode: {
            key: {
                encrypted: EncryptedShareCrypto;
                decrypted: DecryptedShareKey;
            };
            encryptedName: string;
            armoredHashKey: string;
        };
    }>;
    decryptRootShare(share: EncryptedRootShare): Promise<{
        share: DecryptedRootShare;
        key: DecryptedShareKey;
    }>;
    private reportDecryptionError;
    private reportVerificationError;
}
