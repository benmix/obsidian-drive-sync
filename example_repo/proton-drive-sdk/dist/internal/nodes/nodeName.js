"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitExtension = splitExtension;
exports.joinNameAndExtension = joinNameAndExtension;
/**
 * Split a filename into `[name, extension]`
 */
function splitExtension(filename = '') {
    const endIdx = filename.lastIndexOf('.');
    if (endIdx === -1 || endIdx === 0 || endIdx === filename.length - 1) {
        return [filename, ''];
    }
    return [filename.slice(0, endIdx), filename.slice(endIdx + 1)];
}
/**
 * Join a filename into `name (index).extension`
 */
function joinNameAndExtension(name, index, extension) {
    if (!name && !extension) {
        return `(${index})`;
    }
    if (!name) {
        return `(${index}).${extension}`;
    }
    if (!extension) {
        return `${name} (${index})`;
    }
    return `${name} (${index}).${extension}`;
}
//# sourceMappingURL=nodeName.js.map