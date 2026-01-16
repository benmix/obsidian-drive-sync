"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interface_1 = require("../../interface");
const errors_1 = require("../../errors");
const logger_1 = require("../../tests/logger");
const manager_1 = require("./manager");
describe('DevicesManager', () => {
    let logger;
    let apiService;
    let cryptoService;
    let sharesService;
    let nodesService;
    let nodesManagementService;
    let manager;
    beforeEach(() => {
        logger = (0, logger_1.getMockLogger)();
        // @ts-expect-error No need to implement all methods for mocking
        apiService = {
            createDevice: jest.fn(),
            getDevices: jest.fn(),
            removeNameFromDevice: jest.fn(),
            deleteDevice: jest.fn(),
        };
        // @ts-expect-error No need to implement all methods for mocking
        cryptoService = {
            createDevice: jest.fn(),
        };
        // @ts-expect-error No need to implement all methods for mocking
        sharesService = {
            getRootIDs: jest.fn(),
        };
        // @ts-expect-error No need to implement all methods for mocking
        nodesService = {};
        nodesManagementService = {
            renameNode: jest.fn(),
        };
        manager = new manager_1.DevicesManager(logger, apiService, cryptoService, sharesService, nodesService, nodesManagementService);
    });
    it('creates device', async () => {
        const volumeId = 'volume123';
        const name = 'Test Device';
        const deviceType = interface_1.DeviceType.Linux;
        const address = { addressId: 'address123', addressKeyId: 'key123' };
        const shareKey = {
            armoredKey: 'armoredKey',
            armoredPassphrase: 'passphrase',
            armoredPassphraseSignature: 'signature',
        };
        const node = {
            encryptedName: 'encryptedName',
            key: {
                armoredKey: 'nodeKey',
                armoredPassphrase: 'nodePassphrase',
                armoredPassphraseSignature: 'nodeSignature',
            },
            armoredHashKey: 'hashKey',
        };
        const createdDevice = {
            uid: 'device123',
            rootFolderUid: 'rootFolder123',
            type: deviceType,
            shareId: 'shareid',
        };
        sharesService.getRootIDs.mockResolvedValue({ volumeId });
        cryptoService.createDevice.mockResolvedValue({ address, shareKey, node });
        apiService.createDevice.mockResolvedValue(createdDevice);
        const result = await manager.createDevice(name, deviceType);
        expect(sharesService.getRootIDs).toHaveBeenCalled();
        expect(cryptoService.createDevice).toHaveBeenCalledWith(name);
        expect(apiService.createDevice).toHaveBeenCalledWith({ volumeId, type: deviceType }, {
            addressId: address.addressId,
            addressKeyId: address.addressKeyId,
            armoredKey: shareKey.armoredKey,
            armoredSharePassphrase: shareKey.armoredPassphrase,
            armoredSharePassphraseSignature: shareKey.armoredPassphraseSignature,
        }, {
            encryptedName: node.encryptedName,
            armoredKey: node.key.armoredKey,
            armoredNodePassphrase: node.key.armoredPassphrase,
            armoredNodePassphraseSignature: node.key.armoredPassphraseSignature,
            armoredHashKey: node.armoredHashKey,
        });
        expect(result).toEqual({ ...createdDevice, name: { ok: true, value: name } });
    });
    it('renames device with deprecated name', async () => {
        const deviceUid = 'device123';
        const name = 'New Device Name';
        const device = {
            uid: deviceUid,
            rootFolderUid: 'rootFolder123',
            hasDeprecatedName: true,
            shareId: 'shareid',
        };
        apiService.getDevices.mockResolvedValue([device]);
        const result = await manager.renameDevice(deviceUid, name);
        expect(apiService.getDevices).toHaveBeenCalled();
        expect(apiService.removeNameFromDevice).toHaveBeenCalledWith(deviceUid);
        expect(nodesManagementService.renameNode).toHaveBeenCalledWith(device.rootFolderUid, name, {
            allowRenameRootNode: true,
        });
        expect(result).toEqual({ ...device, name: { ok: true, value: name } });
    });
    it('renames device without deprecated name', async () => {
        const deviceUid = 'device123';
        const name = 'New Device Name';
        const device = {
            uid: deviceUid,
            rootFolderUid: 'rootFolder123',
            hasDeprecatedName: false,
            shareId: 'shareid',
        };
        apiService.getDevices.mockResolvedValue([device]);
        const result = await manager.renameDevice(deviceUid, name);
        expect(apiService.getDevices).toHaveBeenCalled();
        expect(apiService.removeNameFromDevice).not.toHaveBeenCalled();
        expect(nodesManagementService.renameNode).toHaveBeenCalledWith(device.rootFolderUid, name, {
            allowRenameRootNode: true,
        });
        expect(result).toEqual({ ...device, name: { ok: true, value: name } });
    });
    it('renames non-existing device', async () => {
        const deviceUid = 'nonexistentDevice';
        const name = 'New Device Name';
        apiService.getDevices.mockResolvedValue([]);
        await expect(manager.renameDevice(deviceUid, name)).rejects.toThrow(errors_1.ValidationError);
        expect(apiService.getDevices).toHaveBeenCalled();
        expect(apiService.removeNameFromDevice).not.toHaveBeenCalled();
        expect(nodesManagementService.renameNode).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=manager.test.js.map