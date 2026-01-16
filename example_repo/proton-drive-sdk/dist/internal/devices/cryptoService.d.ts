import { DriveCrypto } from '../../crypto';
import { SharesService } from './interface';
/**
 * Provides crypto operations for devices.
 */
export declare class DevicesCryptoService {
    private driveCrypto;
    private sharesService;
    constructor(driveCrypto: DriveCrypto, sharesService: SharesService);
    createDevice(deviceName: string): Promise<{
        address: {
            addressId: string;
            addressKeyId: string;
        };
        shareKey: {
            armoredKey: string;
            armoredPassphrase: string;
            armoredPassphraseSignature: string;
        };
        node: {
            key: {
                armoredKey: string;
                armoredPassphrase: string;
                armoredPassphraseSignature: string;
            };
            encryptedName: string;
            armoredHashKey: string;
        };
    }>;
}
