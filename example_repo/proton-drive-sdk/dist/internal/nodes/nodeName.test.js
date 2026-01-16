"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodeName_1 = require("./nodeName");
describe('nodeName', () => {
    describe('splitExtension', () => {
        it('should handle empty string', () => {
            const result = (0, nodeName_1.splitExtension)('');
            expect(result).toEqual(['', '']);
        });
        it('should split filename with extension correctly', () => {
            const result = (0, nodeName_1.splitExtension)('document.pdf');
            expect(result).toEqual(['document', 'pdf']);
        });
        it('should handle filename without extension', () => {
            const result = (0, nodeName_1.splitExtension)('folder');
            expect(result).toEqual(['folder', '']);
        });
        it('should split filename with multiple dots correctly', () => {
            const result = (0, nodeName_1.splitExtension)('my.file.name.txt');
            expect(result).toEqual(['my.file.name', 'txt']);
        });
        it('should handle filename ending with dot', () => {
            const result = (0, nodeName_1.splitExtension)('dot.');
            expect(result).toEqual(['dot.', '']);
        });
        it('should handle filename with only extension', () => {
            const result = (0, nodeName_1.splitExtension)('.gitignore');
            expect(result).toEqual(['.gitignore', '']);
        });
    });
    describe('joinNameAndExtension', () => {
        it('should join name, index, and extension correctly', () => {
            const result = (0, nodeName_1.joinNameAndExtension)('document', 1, 'pdf');
            expect(result).toBe('document (1).pdf');
        });
        it('should handle empty name with extension', () => {
            const result = (0, nodeName_1.joinNameAndExtension)('', 2, 'txt');
            expect(result).toBe('(2).txt');
        });
        it('should handle name with empty extension', () => {
            const result = (0, nodeName_1.joinNameAndExtension)('document', 3, '');
            expect(result).toBe('document (3)');
        });
        it('should handle both name and extension empty', () => {
            const result = (0, nodeName_1.joinNameAndExtension)('', 4, '');
            expect(result).toBe('(4)');
        });
    });
});
//# sourceMappingURL=nodeName.test.js.map