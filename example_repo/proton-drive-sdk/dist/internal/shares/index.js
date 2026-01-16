"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareTargetType = void 0;
exports.initSharesModule = initSharesModule;
const apiService_1 = require("./apiService");
const cryptoCache_1 = require("./cryptoCache");
const cache_1 = require("./cache");
const cryptoService_1 = require("./cryptoService");
const manager_1 = require("./manager");
var interface_1 = require("./interface");
Object.defineProperty(exports, "ShareTargetType", { enumerable: true, get: function () { return interface_1.ShareTargetType; } });
/**
 * Provides facade for the whole shares module.
 *
 * The shares module is responsible for handling shares metadata, including
 * API communication, encryption, decryption, caching, and event handling.
 *
 * This facade provides internal interface that other modules can use to
 * interact with the shares.
 */
function initSharesModule(telemetry, apiService, driveEntitiesCache, driveCryptoCache, account, crypto) {
    const api = new apiService_1.SharesAPIService(apiService);
    const cache = new cache_1.SharesCache(telemetry.getLogger('shares-cache'), driveEntitiesCache);
    const cryptoCache = new cryptoCache_1.SharesCryptoCache(telemetry.getLogger('shares-cache'), driveCryptoCache);
    const cryptoService = new cryptoService_1.SharesCryptoService(telemetry, crypto, account);
    const sharesManager = new manager_1.SharesManager(telemetry.getLogger('shares'), api, cache, cryptoCache, cryptoService, account);
    return sharesManager;
}
//# sourceMappingURL=index.js.map