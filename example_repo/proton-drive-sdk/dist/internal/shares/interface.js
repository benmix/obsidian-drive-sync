"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareType = exports.ShareTargetType = void 0;
var ShareTargetType;
(function (ShareTargetType) {
    ShareTargetType[ShareTargetType["Root"] = 0] = "Root";
    ShareTargetType[ShareTargetType["Folder"] = 1] = "Folder";
    ShareTargetType[ShareTargetType["File"] = 2] = "File";
    ShareTargetType[ShareTargetType["Album"] = 3] = "Album";
    ShareTargetType[ShareTargetType["Photo"] = 4] = "Photo";
    ShareTargetType[ShareTargetType["ProtonVendor"] = 5] = "ProtonVendor";
})(ShareTargetType || (exports.ShareTargetType = ShareTargetType = {}));
var ShareType;
(function (ShareType) {
    ShareType["Main"] = "main";
    ShareType["Standard"] = "standard";
    ShareType["Device"] = "device";
    ShareType["Photo"] = "photo";
})(ShareType || (exports.ShareType = ShareType = {}));
//# sourceMappingURL=interface.js.map