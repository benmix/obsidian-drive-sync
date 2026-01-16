"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesCryptoService = void 0;
/**
 * Provides crypto operations for devices.
 */
class DevicesCryptoService {
    driveCrypto;
    sharesService;
    constructor(driveCrypto, sharesService) {
        this.driveCrypto = driveCrypto;
        this.sharesService = sharesService;
        this.driveCrypto = driveCrypto;
        this.sharesService = sharesService;
    }
    async createDevice(deviceName) {
        const address = await this.sharesService.getMyFilesShareMemberEmailKey();
        const addressKey = address.addressKey;
        const shareKey = await this.driveCrypto.generateKey([addressKey], addressKey);
        const rootNodeKey = await this.driveCrypto.generateKey([shareKey.decrypted.key], addressKey);
        const { armoredNodeName } = await this.driveCrypto.encryptNodeName(deviceName, undefined, shareKey.decrypted.key, addressKey);
        const { armoredHashKey } = await this.driveCrypto.generateHashKey(rootNodeKey.decrypted.key);
        return {
            address: {
                addressId: address.addressId,
                addressKeyId: address.addressKeyId,
            },
            shareKey: {
                armoredKey: shareKey.encrypted.armoredKey,
                armoredPassphrase: shareKey.encrypted.armoredPassphrase,
                armoredPassphraseSignature: shareKey.encrypted.armoredPassphraseSignature,
            },
            node: {
                key: {
                    armoredKey: rootNodeKey.encrypted.armoredKey,
                    armoredPassphrase: rootNodeKey.encrypted.armoredPassphrase,
                    armoredPassphraseSignature: rootNodeKey.encrypted.armoredPassphraseSignature,
                },
                encryptedName: armoredNodeName,
                armoredHashKey,
            },
        };
    }
}
exports.DevicesCryptoService = DevicesCryptoService;
//# sourceMappingURL=cryptoService.js.map