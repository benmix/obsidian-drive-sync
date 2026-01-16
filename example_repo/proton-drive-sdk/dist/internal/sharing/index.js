"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSharingModule = initSharingModule;
const shares_1 = require("../shares");
const apiService_1 = require("./apiService");
const cache_1 = require("./cache");
const cryptoService_1 = require("./cryptoService");
const sharingAccess_1 = require("./sharingAccess");
const sharingManagement_1 = require("./sharingManagement");
const events_1 = require("./events");
// Root shares are not allowed to be shared.
// Photos and Albums are not supported in main volume (core Drive).
const DEFAULT_SHARE_TARGET_TYPES = [shares_1.ShareTargetType.Folder, shares_1.ShareTargetType.File, shares_1.ShareTargetType.ProtonVendor];
/**
 * Provides facade for the whole sharing module.
 *
 * The sharing module is responsible for handling invitations, bookmarks,
 * standard shares, listing shared nodes, etc. It includes API communication,
 * encryption, decryption, caching, and event handling.
 */
function initSharingModule(telemetry, apiService, driveEntitiesCache, account, crypto, sharesService, nodesService, shareTargetTypes = DEFAULT_SHARE_TARGET_TYPES) {
    const api = new apiService_1.SharingAPIService(telemetry.getLogger('sharing-api'), apiService, shareTargetTypes);
    const cache = new cache_1.SharingCache(driveEntitiesCache);
    const cryptoService = new cryptoService_1.SharingCryptoService(telemetry, crypto, account, sharesService);
    const sharingAccess = new sharingAccess_1.SharingAccess(api, cache, cryptoService, sharesService, nodesService);
    const sharingManagement = new sharingManagement_1.SharingManagement(telemetry.getLogger('sharing'), api, cache, cryptoService, account, sharesService, nodesService);
    const sharingEventHandler = new events_1.SharingEventHandler(telemetry.getLogger('sharing-event-handler'), cache, sharesService);
    return {
        access: sharingAccess,
        eventHandler: sharingEventHandler,
        management: sharingManagement,
    };
}
//# sourceMappingURL=index.js.map