"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultOk = resultOk;
exports.resultError = resultError;
function resultOk(value) {
    return { ok: true, value };
}
function resultError(error) {
    return { ok: false, error };
}
//# sourceMappingURL=result.js.map