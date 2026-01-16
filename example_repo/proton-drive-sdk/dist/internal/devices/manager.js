"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesManager = void 0;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
const interface_1 = require("../../interface");
class DevicesManager {
    logger;
    apiService;
    cryptoService;
    sharesService;
    nodesService;
    nodesManagementService;
    constructor(logger, apiService, cryptoService, sharesService, nodesService, nodesManagementService) {
        this.logger = logger;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.sharesService = sharesService;
        this.nodesService = nodesService;
        this.nodesManagementService = nodesManagementService;
        this.logger = logger;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.sharesService = sharesService;
        this.nodesService = nodesService;
        this.nodesManagementService = nodesManagementService;
    }
    async *iterateDevices(signal) {
        const devices = await this.apiService.getDevices(signal);
        const nodeUidToDevice = new Map();
        for (const device of devices) {
            nodeUidToDevice.set(device.rootFolderUid, device);
        }
        for await (const node of this.nodesService.iterateNodes(Array.from(nodeUidToDevice.keys()), signal)) {
            if ('missingUid' in node) {
                continue;
            }
            const device = nodeUidToDevice.get(node.uid);
            if (device) {
                yield {
                    ...device,
                    name: node.name,
                };
            }
        }
    }
    async createDevice(name, deviceType) {
        const { volumeId } = await this.sharesService.getRootIDs();
        const { address, shareKey, node } = await this.cryptoService.createDevice(name);
        const device = await this.apiService.createDevice({
            volumeId,
            type: deviceType,
        }, {
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
        return {
            ...device,
            name: (0, interface_1.resultOk)(name),
        };
    }
    async renameDevice(deviceUid, name) {
        const device = await this.getDeviceMetadata(deviceUid);
        if (device.hasDeprecatedName) {
            this.logger.info('Removing deprecated name from device');
            try {
                await this.apiService.removeNameFromDevice(deviceUid);
            }
            catch (error) {
                this.logger.error('Failed to remove name from device', error);
            }
        }
        await this.nodesManagementService.renameNode(device.rootFolderUid, name, {
            allowRenameRootNode: true,
        });
        return {
            ...device,
            name: (0, interface_1.resultOk)(name),
        };
    }
    async getDeviceMetadata(deviceUid) {
        const devices = await this.apiService.getDevices();
        const device = devices.find((device) => device.uid === deviceUid);
        if (!device) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Device not found`);
        }
        return device;
    }
    async deleteDevice(deviceUid) {
        await this.apiService.deleteDevice(deviceUid);
    }
}
exports.DevicesManager = DevicesManager;
//# sourceMappingURL=manager.js.map