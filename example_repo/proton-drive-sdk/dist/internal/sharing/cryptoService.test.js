"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interface_1 = require("../../interface");
const telemetry_1 = require("../../tests/telemetry");
const cryptoService_1 = require("./cryptoService");
describe('SharingCryptoService', () => {
    let telemetry;
    let driveCrypto;
    let account;
    let sharesService;
    let cryptoService;
    beforeEach(() => {
        telemetry = (0, telemetry_1.getMockTelemetry)();
        // @ts-expect-error No need to implement all methods for mocking
        driveCrypto = {
            decryptShareUrlPassword: jest.fn().mockResolvedValue('urlPassword'),
            decryptKeyWithSrpPassword: jest.fn().mockResolvedValue({
                key: 'decryptedKey',
            }),
            decryptNodeName: jest.fn().mockResolvedValue({
                name: 'nodeName',
            }),
        };
        account = {
            // @ts-expect-error No need to implement full response for mocking
            getOwnAddress: jest.fn(async () => ({
                keys: [{ key: 'addressKey' }],
            })),
        };
        // @ts-expect-error No need to implement all methods for mocking
        sharesService = {
            getMyFilesShareMemberEmailKey: jest.fn().mockResolvedValue({
                addressId: 'addressId',
            }),
        };
        cryptoService = new cryptoService_1.SharingCryptoService(telemetry, driveCrypto, account, sharesService);
    });
    describe('decryptBookmark', () => {
        const encryptedBookmark = {
            tokenId: 'tokenId',
            creationTime: new Date(),
            url: {
                encryptedUrlPassword: 'encryptedUrlPassword',
                base64SharePasswordSalt: 'base64SharePasswordSalt',
            },
            share: {
                armoredKey: 'armoredKey',
                armoredPassphrase: 'armoredPassphrase',
            },
            node: {
                type: interface_1.NodeType.File,
                mediaType: 'mediaType',
                encryptedName: 'encryptedName',
                armoredKey: 'armoredKey',
                armoredNodePassphrase: 'armoredNodePassphrase',
                file: {
                    base64ContentKeyPacket: 'base64ContentKeyPacket',
                },
            },
        };
        it('should decrypt bookmark', async () => {
            const result = await cryptoService.decryptBookmark(encryptedBookmark);
            expect(result).toMatchObject({
                url: (0, interface_1.resultOk)('https://drive.proton.me/urls/tokenId#urlPassword'),
                nodeName: (0, interface_1.resultOk)('nodeName'),
            });
            expect(driveCrypto.decryptShareUrlPassword).toHaveBeenCalledWith('encryptedUrlPassword', ['addressKey']);
            expect(driveCrypto.decryptKeyWithSrpPassword).toHaveBeenCalledWith('urlPassword', 'base64SharePasswordSalt', 'armoredKey', 'armoredPassphrase');
            expect(driveCrypto.decryptNodeName).toHaveBeenCalledWith('encryptedName', 'decryptedKey', []);
            expect(telemetry.recordMetric).not.toHaveBeenCalled();
        });
        it('should decrypt bookmark with custom password', async () => {
            // First 12 characters are the generated password. Anything beyond is the custom password.
            driveCrypto.decryptShareUrlPassword = jest.fn().mockResolvedValue('urlPassword1WithCustomPassword');
            const result = await cryptoService.decryptBookmark(encryptedBookmark);
            expect(result).toMatchObject({
                url: (0, interface_1.resultOk)('https://drive.proton.me/urls/tokenId#urlPassword1'),
                nodeName: (0, interface_1.resultOk)('nodeName'),
            });
            expect(driveCrypto.decryptShareUrlPassword).toHaveBeenCalledWith('encryptedUrlPassword', ['addressKey']);
            expect(driveCrypto.decryptKeyWithSrpPassword).toHaveBeenCalledWith('urlPassword1WithCustomPassword', 'base64SharePasswordSalt', 'armoredKey', 'armoredPassphrase');
            expect(driveCrypto.decryptNodeName).toHaveBeenCalledWith('encryptedName', 'decryptedKey', []);
            expect(telemetry.recordMetric).not.toHaveBeenCalled();
        });
        it('should handle undecryptable URL password', async () => {
            const error = new Error('Failed to decrypt URL password');
            driveCrypto.decryptShareUrlPassword = jest.fn().mockRejectedValue(error);
            const result = await cryptoService.decryptBookmark(encryptedBookmark);
            expect(result).toMatchObject({
                url: (0, interface_1.resultError)(new Error('Failed to decrypt bookmark password: Failed to decrypt URL password')),
                nodeName: (0, interface_1.resultError)(new Error('Failed to decrypt bookmark password: Failed to decrypt URL password')),
            });
            expect(telemetry.recordMetric).toHaveBeenCalledWith({
                eventName: 'decryptionError',
                volumeType: interface_1.MetricVolumeType.SharedPublic,
                field: 'shareUrlPassword',
                error,
                uid: 'tokenId',
            });
        });
        it('should handle undecryptable share key', async () => {
            const error = new Error('Failed to decrypt share key');
            driveCrypto.decryptKeyWithSrpPassword = jest.fn().mockRejectedValue(error);
            const result = await cryptoService.decryptBookmark(encryptedBookmark);
            expect(result).toMatchObject({
                url: (0, interface_1.resultOk)('https://drive.proton.me/urls/tokenId#urlPassword'),
                nodeName: (0, interface_1.resultError)(new Error('Failed to decrypt bookmark key: Failed to decrypt share key')),
            });
            expect(telemetry.recordMetric).toHaveBeenCalledWith({
                eventName: 'decryptionError',
                volumeType: interface_1.MetricVolumeType.SharedPublic,
                field: 'shareKey',
                error,
                uid: 'tokenId',
            });
        });
        it('should handle undecryptable node name', async () => {
            const error = new Error('Failed to decrypt node name');
            driveCrypto.decryptNodeName = jest.fn().mockRejectedValue(error);
            const result = await cryptoService.decryptBookmark(encryptedBookmark);
            expect(result).toMatchObject({
                url: (0, interface_1.resultOk)('https://drive.proton.me/urls/tokenId#urlPassword'),
                nodeName: (0, interface_1.resultError)(new Error('Failed to decrypt bookmark name: Failed to decrypt node name')),
            });
            expect(telemetry.recordMetric).toHaveBeenCalledWith({
                eventName: 'decryptionError',
                volumeType: interface_1.MetricVolumeType.SharedPublic,
                field: 'nodeName',
                error,
                uid: 'tokenId',
            });
        });
        it('should handle invalid node name', async () => {
            driveCrypto.decryptNodeName = jest.fn().mockResolvedValue({
                name: 'invalid/name',
            });
            const result = await cryptoService.decryptBookmark(encryptedBookmark);
            expect(result).toMatchObject({
                url: (0, interface_1.resultOk)('https://drive.proton.me/urls/tokenId#urlPassword'),
                nodeName: (0, interface_1.resultError)({
                    name: 'invalid/name',
                    error: "Name must not contain the character '/'",
                }),
            });
        });
    });
});
//# sourceMappingURL=cryptoService.test.js.map