"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFileExtendedAttributes = void 0;
exports.initNodesModule = initNodesModule;
const apiService_1 = require("./apiService");
const cache_1 = require("./cache");
const cryptoCache_1 = require("./cryptoCache");
const cryptoService_1 = require("./cryptoService");
const cryptoReporter_1 = require("./cryptoReporter");
const nodesAccess_1 = require("./nodesAccess");
const nodesManagement_1 = require("./nodesManagement");
const nodesRevisions_1 = require("./nodesRevisions");
const events_1 = require("./events");
var extendedAttributes_1 = require("./extendedAttributes");
Object.defineProperty(exports, "generateFileExtendedAttributes", { enumerable: true, get: function () { return extendedAttributes_1.generateFileExtendedAttributes; } });
/**
 * Provides facade for the whole nodes module.
 *
 * The nodes module is responsible for handling node metadata, including
 * API communication, encryption, decryption, caching, and event handling.
 *
 * This facade provides internal interface that other modules can use to
 * interact with the nodes.
 */
function initNodesModule(telemetry, apiService, driveEntitiesCache, driveCryptoCache, account, driveCrypto, sharesService, clientUid) {
    const api = new apiService_1.NodeAPIService(telemetry.getLogger('nodes-api'), apiService, clientUid);
    const cache = new cache_1.NodesCache(telemetry.getLogger('nodes-cache'), driveEntitiesCache);
    const cryptoCache = new cryptoCache_1.NodesCryptoCache(telemetry.getLogger('nodes-cache'), driveCryptoCache);
    const cryptoReporter = new cryptoReporter_1.NodesCryptoReporter(telemetry, sharesService);
    const cryptoService = new cryptoService_1.NodesCryptoService(telemetry, driveCrypto, account, cryptoReporter);
    const nodesAccess = new nodesAccess_1.NodesAccess(telemetry, api, cache, cryptoCache, cryptoService, sharesService);
    const nodesEventHandler = new events_1.NodesEventsHandler(telemetry.getLogger('nodes-events'), cache);
    const nodesManagement = new nodesManagement_1.NodesManagement(api, cryptoCache, cryptoService, nodesAccess);
    const nodesRevisions = new nodesRevisions_1.NodesRevisons(telemetry.getLogger('nodes'), api, cryptoService, nodesAccess);
    return {
        access: nodesAccess,
        management: nodesManagement,
        revisions: nodesRevisions,
        eventHandler: nodesEventHandler,
    };
}
//# sourceMappingURL=index.js.map