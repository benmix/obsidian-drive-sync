"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCodeOk = isCodeOk;
exports.isCodeOkAsync = isCodeOkAsync;
function isCodeOk(code) {
    return code === 1000 /* ErrorCode.OK */ || code === 1001 /* ErrorCode.OK_MANY */ || code === 1002 /* ErrorCode.OK_ASYNC */;
}
function isCodeOkAsync(code) {
    return code === 1002 /* ErrorCode.OK_ASYNC */;
}
//# sourceMappingURL=errorCodes.js.map