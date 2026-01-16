"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeOutOfSyncError = void 0;
const errors_1 = require("../../errors");
class NodeOutOfSyncError extends errors_1.ValidationError {
    name = 'NodeOutOfSyncError';
}
exports.NodeOutOfSyncError = NodeOutOfSyncError;
//# sourceMappingURL=errors.js.map