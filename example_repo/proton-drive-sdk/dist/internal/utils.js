"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeUint8Arrays = mergeUint8Arrays;
function mergeUint8Arrays(arrays) {
    const length = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const chunksAll = new Uint8Array(length);
    arrays.reduce((position, arr) => {
        chunksAll.set(arr, position);
        return position + arr.length;
    }, 0);
    return chunksAll;
}
//# sourceMappingURL=utils.js.map