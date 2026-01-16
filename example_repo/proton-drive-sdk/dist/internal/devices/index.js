"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDevicesModule = initDevicesModule;
const apiService_1 = require("./apiService");
const cryptoService_1 = require("./cryptoService");
const manager_1 = require("./manager");
/**
 * Provides facade for the whole devices module.
 *
 * The devices module is responsible for handling devices metadata, including
 * API communication, encryption, decryption, caching, and event handling.
 *
 * This facade provides internal interface that other modules can use to
 * interact with the devices.
 */
function initDevicesModule(telemetry, apiService, driveCrypto, sharesService, nodesService, nodesManagementService) {
    const api = new apiService_1.DevicesAPIService(apiService);
    const cryptoService = new cryptoService_1.DevicesCryptoService(driveCrypto, sharesService);
    const manager = new manager_1.DevicesManager(telemetry.getLogger('devices'), api, cryptoService, sharesService, nodesService, nodesManagementService);
    return manager;
}
//# sourceMappingURL=index.js.map