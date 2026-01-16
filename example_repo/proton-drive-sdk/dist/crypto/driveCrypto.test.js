"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const driveCrypto_1 = require("./driveCrypto");
describe('uint8ArrayToUtf8', () => {
    it('should convert a Uint8Array to a UTF-8 string', () => {
        const input = new Uint8Array([72, 101, 108, 108, 111]);
        const expectedOutput = 'Hello';
        const result = (0, driveCrypto_1.uint8ArrayToUtf8)(input);
        expect(result).toBe(expectedOutput);
    });
    it('should handle an empty Uint8Array', () => {
        const input = new Uint8Array([]);
        const expectedOutput = '';
        const result = (0, driveCrypto_1.uint8ArrayToUtf8)(input);
        expect(result).toBe(expectedOutput);
    });
    it('should throw if input is invalid', () => {
        const input = new Uint8Array([887987979887897989]);
        expect(() => (0, driveCrypto_1.uint8ArrayToUtf8)(input)).toThrow('The encoded data was not valid for encoding utf-8');
    });
});
describe('arrayToHexString', () => {
    it('should convert a Uint8Array to a hex string', () => {
        const input = new Uint8Array([0, 255, 16, 32]);
        const expectedOutput = '00ff1020';
        const result = (0, driveCrypto_1.arrayToHexString)(input);
        expect(result).toBe(expectedOutput);
    });
    it('should handle an empty Uint8Array', () => {
        const input = new Uint8Array([]);
        const expectedOutput = '';
        const result = (0, driveCrypto_1.arrayToHexString)(input);
        expect(result).toBe(expectedOutput);
    });
    it('should handle a Uint8Array with one element', () => {
        const input = new Uint8Array([1]);
        const expectedOutput = '01';
        const result = (0, driveCrypto_1.arrayToHexString)(input);
        expect(result).toBe(expectedOutput);
    });
});
//# sourceMappingURL=driveCrypto.test.js.map