"use strict";
/**
 * Use only what is exported here. This is the public supported API of the SDK.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.ProtonDriveClient = exports.NullFeatureFlagProvider = exports.OpenPGPCryptoWithCryptoProxy = void 0;
exports.generateNodeUid = generateNodeUid;
const uids_1 = require("./internal/uids");
__exportStar(require("./interface"), exports);
__exportStar(require("./cache"), exports);
__exportStar(require("./errors"), exports);
var crypto_1 = require("./crypto");
Object.defineProperty(exports, "OpenPGPCryptoWithCryptoProxy", { enumerable: true, get: function () { return crypto_1.OpenPGPCryptoWithCryptoProxy; } });
var featureFlags_1 = require("./featureFlags");
Object.defineProperty(exports, "NullFeatureFlagProvider", { enumerable: true, get: function () { return featureFlags_1.NullFeatureFlagProvider; } });
var protonDriveClient_1 = require("./protonDriveClient");
Object.defineProperty(exports, "ProtonDriveClient", { enumerable: true, get: function () { return protonDriveClient_1.ProtonDriveClient; } });
var version_1 = require("./version");
Object.defineProperty(exports, "VERSION", { enumerable: true, get: function () { return version_1.VERSION; } });
/**
 * Provides the node UID for the given raw volume and node IDs.
 *
 * This is required only for the internal implementation to provide
 * backward compatibility with the old Drive web setup.
 *
 * If you are having share ID, use `ProtonDriveClient::getNodeUid` instead.
 *
 * @deprecated This method is not part of the public API.
 * @param volumeId - Volume of the node.
 * @param nodeId - Node/link ID (not UID).
 * @returns The node UID.
 */
function generateNodeUid(volumeId, nodeId) {
    return (0, uids_1.makeNodeUid)(volumeId, nodeId);
}
//# sourceMappingURL=index.js.map