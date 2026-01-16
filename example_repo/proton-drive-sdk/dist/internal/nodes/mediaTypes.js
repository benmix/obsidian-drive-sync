"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProtonDocument = isProtonDocument;
exports.isProtonSheet = isProtonSheet;
const PROTON_DOC_MEDIA_TYPE = 'application/vnd.proton.doc';
const PROTON_SHEET_MEDIA_TYPE = 'application/vnd.proton.sheet';
function isProtonDocument(mediaType) {
    return mediaType === PROTON_DOC_MEDIA_TYPE;
}
function isProtonSheet(mediaType) {
    return mediaType === PROTON_SHEET_MEDIA_TYPE;
}
//# sourceMappingURL=mediaTypes.js.map