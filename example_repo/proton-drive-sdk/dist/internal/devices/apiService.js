"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesAPIService = void 0;
const interface_1 = require("../../interface");
const uids_1 = require("../uids");
/**
 * Provides API communication for managing devices.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
class DevicesAPIService {
    apiService;
    constructor(apiService) {
        this.apiService = apiService;
        this.apiService = apiService;
    }
    async getDevices(signal) {
        const response = await this.apiService.get('drive/devices', signal);
        return response.Devices.map((device) => ({
            uid: (0, uids_1.makeDeviceUid)(device.Device.VolumeID, device.Device.DeviceID),
            type: deviceTypeNumberToEnum(device.Device.Type),
            rootFolderUid: (0, uids_1.makeNodeUid)(device.Device.VolumeID, device.Share.LinkID),
            creationTime: new Date(device.Device.CreateTime * 1000),
            lastSyncTime: device.Device.LastSyncTime ? new Date(device.Device.LastSyncTime * 1000) : undefined,
            hasDeprecatedName: !!device.Share.Name,
            /** @deprecated to be removed once Volume-based navigation is implemented in web */
            shareId: device.Share.ShareID,
        }));
    }
    /**
     * Originally the device name was on the share of the device.
     * This was changed to be on the root node of the device instead.
     * Old devices will still have the name on the share and when
     * the client renames the device, it must be removed on the device.
     */
    async removeNameFromDevice(deviceUid) {
        const { deviceId } = (0, uids_1.splitDeviceUid)(deviceUid);
        await this.apiService.put(`drive/devices/${deviceId}`, {
            Share: { Name: '' },
        });
    }
    async createDevice(device, share, node) {
        const response = await this.apiService.post('drive/devices', {
            // @ts-expect-error VolumeID is deprecated.
            Device: {
                Type: deviceTypeEnumToNumber(device.type),
                SyncState: 0,
            },
            // @ts-expect-error Name is deprecated.
            Share: {
                AddressID: share.addressId,
                AddressKeyID: share.addressKeyId,
                Key: share.armoredKey,
                Passphrase: share.armoredSharePassphrase,
                PassphraseSignature: share.armoredSharePassphraseSignature,
            },
            Link: {
                Name: node.encryptedName,
                NodeKey: node.armoredKey,
                NodePassphrase: node.armoredNodePassphrase,
                NodePassphraseSignature: node.armoredNodePassphraseSignature,
                NodeHashKey: node.armoredHashKey,
            },
        });
        return {
            uid: (0, uids_1.makeDeviceUid)(device.volumeId, response.Device.DeviceID),
            type: device.type,
            rootFolderUid: (0, uids_1.makeNodeUid)(device.volumeId, response.Device.LinkID),
            creationTime: new Date(),
            hasDeprecatedName: false,
            shareId: response.Device.ShareID,
        };
    }
    async deleteDevice(deviceUid) {
        const { deviceId } = (0, uids_1.splitDeviceUid)(deviceUid);
        await this.apiService.delete(`drive/devices/${deviceId}`);
    }
}
exports.DevicesAPIService = DevicesAPIService;
function deviceTypeNumberToEnum(deviceType) {
    switch (deviceType) {
        case 1:
            return interface_1.DeviceType.Windows;
        case 2:
            return interface_1.DeviceType.MacOS;
        case 3:
            return interface_1.DeviceType.Linux;
        default:
            throw new Error(`Unknown device type: ${deviceType}`);
    }
}
function deviceTypeEnumToNumber(deviceType) {
    switch (deviceType.toLowerCase()) {
        case interface_1.DeviceType.Windows.toLowerCase():
            return 1;
        case interface_1.DeviceType.MacOS.toLowerCase():
            return 2;
        case interface_1.DeviceType.Linux.toLowerCase():
            return 3;
        default:
            throw new Error(`Unknown device type: ${deviceType}`);
    }
}
//# sourceMappingURL=apiService.js.map