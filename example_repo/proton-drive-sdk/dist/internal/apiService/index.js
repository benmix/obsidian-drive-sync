"use strict";
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
exports.ObserverStream = exports.memberRoleToPermission = exports.permissionsToMemberRole = exports.nodeTypeNumberToNodeType = exports.isCodeOkAsync = exports.isCodeOk = exports.DriveAPIService = void 0;
var apiService_1 = require("./apiService");
Object.defineProperty(exports, "DriveAPIService", { enumerable: true, get: function () { return apiService_1.DriveAPIService; } });
var errorCodes_1 = require("./errorCodes");
Object.defineProperty(exports, "isCodeOk", { enumerable: true, get: function () { return errorCodes_1.isCodeOk; } });
Object.defineProperty(exports, "isCodeOkAsync", { enumerable: true, get: function () { return errorCodes_1.isCodeOkAsync; } });
var transformers_1 = require("./transformers");
Object.defineProperty(exports, "nodeTypeNumberToNodeType", { enumerable: true, get: function () { return transformers_1.nodeTypeNumberToNodeType; } });
Object.defineProperty(exports, "permissionsToMemberRole", { enumerable: true, get: function () { return transformers_1.permissionsToMemberRole; } });
Object.defineProperty(exports, "memberRoleToPermission", { enumerable: true, get: function () { return transformers_1.memberRoleToPermission; } });
var observerStream_1 = require("./observerStream");
Object.defineProperty(exports, "ObserverStream", { enumerable: true, get: function () { return observerStream_1.ObserverStream; } });
__exportStar(require("./errors"), exports);
//# sourceMappingURL=index.js.map