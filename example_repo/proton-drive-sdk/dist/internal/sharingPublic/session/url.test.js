"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../../../errors");
const url_1 = require("./url");
describe('getTokenAndPasswordFromUrl', () => {
    describe('valid URLs', () => {
        it('should extract token and password from a valid URL', () => {
            const url = 'https://drive.proton.me/urls/abc123#def456';
            const result = (0, url_1.getTokenAndPasswordFromUrl)(url);
            expect(result).toEqual({
                token: 'abc123',
                password: 'def456',
            });
        });
        it('should handle URLs with different domains', () => {
            const url = 'https://example.com/urls/mytoken#mypassword';
            const result = (0, url_1.getTokenAndPasswordFromUrl)(url);
            expect(result).toEqual({
                token: 'mytoken',
                password: 'mypassword',
            });
        });
        it('should handle URLs with query parameters', () => {
            const url = 'https://drive.proton.me/urls/token123?param=value#password456';
            const result = (0, url_1.getTokenAndPasswordFromUrl)(url);
            expect(result).toEqual({
                token: 'token123',
                password: 'password456',
            });
        });
    });
    describe('should throw ValidationError', () => {
        it('when token is missing (no path)', () => {
            const url = 'https://drive.proton.me/#password123';
            expect(() => (0, url_1.getTokenAndPasswordFromUrl)(url)).toThrow(errors_1.ValidationError);
        });
        it('when token is missing (empty path segment)', () => {
            const url = 'https://drive.proton.me/urls/#password123';
            expect(() => (0, url_1.getTokenAndPasswordFromUrl)(url)).toThrow(errors_1.ValidationError);
        });
        it('when password is missing (no hash)', () => {
            const url = 'https://drive.proton.me/urls/token123';
            expect(() => (0, url_1.getTokenAndPasswordFromUrl)(url)).toThrow(errors_1.ValidationError);
            expect(() => (0, url_1.getTokenAndPasswordFromUrl)(url)).toThrow('Invalid URL');
        });
        it('when password is empty (empty hash)', () => {
            const url = 'https://drive.proton.me/urls/token123#';
            expect(() => (0, url_1.getTokenAndPasswordFromUrl)(url)).toThrow(errors_1.ValidationError);
            expect(() => (0, url_1.getTokenAndPasswordFromUrl)(url)).toThrow('Invalid URL');
        });
        it('for empty string', () => {
            expect(() => (0, url_1.getTokenAndPasswordFromUrl)('')).toThrow();
        });
        it('for invalid URL format', () => {
            expect(() => (0, url_1.getTokenAndPasswordFromUrl)('not-a-url')).toThrow();
        });
    });
});
//# sourceMappingURL=url.test.js.map