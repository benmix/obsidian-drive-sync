"use strict";
// This file has copy-pasted utilities from CryptoProxy located in Proton web clients monorepo.
Object.defineProperty(exports, "__esModule", { value: true });
exports.uint8ArrayToBase64String = uint8ArrayToBase64String;
exports.base64StringToUint8Array = base64StringToUint8Array;
function uint8ArrayToBase64String(array) {
    return encodeBase64(arrayToBinaryString(array));
}
function base64StringToUint8Array(string) {
    return binaryStringToArray(decodeBase64(string) || '');
}
const ifDefined = (cb) => (input) => {
    return (input !== undefined ? cb(input) : undefined);
};
const encodeBase64 = ifDefined((input) => btoa(input).trim());
const decodeBase64 = ifDefined((input) => atob(input.trim()));
const arrayToBinaryString = (bytes) => {
    const result = [];
    const bs = 1 << 14;
    const j = bytes.length;
    for (let i = 0; i < j; i += bs) {
        // @ts-expect-error Uint8Array treated as number[]
        // eslint-disable-next-line prefer-spread
        result.push(String.fromCharCode.apply(String, bytes.subarray(i, i + bs < j ? i + bs : j)));
    }
    return result.join('');
};
const binaryStringToArray = (str) => {
    const result = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        result[i] = str.charCodeAt(i);
    }
    return result;
};
//# sourceMappingURL=utils.js.map