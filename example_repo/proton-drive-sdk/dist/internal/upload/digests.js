"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadDigests = void 0;
const legacy_1 = require("@noble/hashes/legacy");
const utils_1 = require("@noble/hashes/utils");
class UploadDigests {
    digestSha1;
    constructor(digestSha1 = legacy_1.sha1.create()) {
        this.digestSha1 = digestSha1;
        this.digestSha1 = digestSha1;
    }
    update(data) {
        this.digestSha1.update(data);
    }
    digests() {
        return {
            sha1: (0, utils_1.bytesToHex)(this.digestSha1.digest()),
        };
    }
}
exports.UploadDigests = UploadDigests;
//# sourceMappingURL=digests.js.map