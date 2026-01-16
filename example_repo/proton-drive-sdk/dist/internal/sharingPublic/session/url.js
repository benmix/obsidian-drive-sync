"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenAndPasswordFromUrl = getTokenAndPasswordFromUrl;
const ttag_1 = require("ttag");
const errors_1 = require("../../../errors");
/**
 * Parse the token and password from the URL.
 *
 * The URL format is: https://drive.proton.me/urls/token#password
 *
 * @param url - The URL of the public link.
 * @returns The token and password.
 */
function getTokenAndPasswordFromUrl(url) {
    const urlObj = new URL(url);
    const token = urlObj.pathname.split('/').pop();
    const password = urlObj.hash.slice(1);
    if (!token || !password) {
        throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Invalid URL`);
    }
    return { token, password };
}
//# sourceMappingURL=url.js.map