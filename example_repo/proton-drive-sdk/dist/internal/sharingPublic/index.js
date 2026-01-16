"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnauthDriveAPIService = exports.SharingPublicSessionManager = void 0;
exports.initSharingPublicModule = initSharingPublicModule;
exports.initSharingPublicNodesModule = initSharingPublicNodesModule;
const nodes_1 = require("./nodes");
const cache_1 = require("../nodes/cache");
const cryptoCache_1 = require("../nodes/cryptoCache");
const cryptoService_1 = require("../nodes/cryptoService");
const nodesRevisions_1 = require("../nodes/nodesRevisions");
const cryptoReporter_1 = require("./cryptoReporter");
const nodes_2 = require("./nodes");
const shares_1 = require("./shares");
var manager_1 = require("./session/manager");
Object.defineProperty(exports, "SharingPublicSessionManager", { enumerable: true, get: function () { return manager_1.SharingPublicSessionManager; } });
var unauthApiService_1 = require("./unauthApiService");
Object.defineProperty(exports, "UnauthDriveAPIService", { enumerable: true, get: function () { return unauthApiService_1.UnauthDriveAPIService; } });
/**
 * Provides facade for the whole sharing public module.
 *
 * The sharing public module is responsible for handling public link data, including
 * API communication, encryption, decryption, and caching.
 *
 * This facade provides internal interface that other modules can use to
 * interact with the public links.
 */
function initSharingPublicModule(telemetry, apiService, driveEntitiesCache, driveCryptoCache, driveCrypto, account, url, token, publicShareKey, publicRootNodeUid, publicRole, isAnonymousContext) {
    const shares = new shares_1.SharingPublicSharesManager(account, publicShareKey, publicRootNodeUid);
    const nodes = initSharingPublicNodesModule(telemetry, apiService, driveEntitiesCache, driveCryptoCache, driveCrypto, account, shares, url, token, publicShareKey, publicRootNodeUid, publicRole, isAnonymousContext);
    return {
        shares,
        nodes,
    };
}
/**
 * Provides facade for the public link nodes module.
 *
 * The public link nodes initializes the core nodes module, but uses public
 * link shares or crypto reporter instead.
 */
function initSharingPublicNodesModule(telemetry, apiService, driveEntitiesCache, driveCryptoCache, driveCrypto, account, sharesService, url, token, publicShareKey, publicRootNodeUid, publicRole, isAnonymousContext) {
    const clientUid = undefined; // No client UID for public context yet.
    const api = new nodes_1.SharingPublicNodesAPIService(telemetry.getLogger('nodes-api'), apiService, clientUid, publicRootNodeUid, publicRole);
    const cache = new cache_1.NodesCache(telemetry.getLogger('nodes-cache'), driveEntitiesCache);
    const cryptoCache = new cryptoCache_1.NodesCryptoCache(telemetry.getLogger('nodes-cache'), driveCryptoCache);
    const cryptoReporter = new cryptoReporter_1.SharingPublicCryptoReporter(telemetry);
    const cryptoService = new cryptoService_1.NodesCryptoService(telemetry, driveCrypto, account, cryptoReporter);
    const nodesAccess = new nodes_2.SharingPublicNodesAccess(telemetry, api, cache, cryptoCache, cryptoService, sharesService, url, token, publicShareKey, publicRootNodeUid, isAnonymousContext);
    const nodesManagement = new nodes_2.SharingPublicNodesManagement(api, cryptoCache, cryptoService, nodesAccess);
    const nodesRevisions = new nodesRevisions_1.NodesRevisons(telemetry.getLogger('nodes'), api, cryptoService, nodesAccess);
    return {
        access: nodesAccess,
        management: nodesManagement,
        revisions: nodesRevisions,
    };
}
//# sourceMappingURL=index.js.map