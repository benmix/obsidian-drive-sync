"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevisionState = exports.MemberRole = exports.NodeType = void 0;
var NodeType;
(function (NodeType) {
    NodeType["File"] = "file";
    NodeType["Folder"] = "folder";
    /**
     * Album is returned only by `ProtonDrivePhotosClient`.
     */
    NodeType["Album"] = "album";
    /**
     * Photo is returned only by `ProtonDrivePhotosClient`.
     */
    NodeType["Photo"] = "photo";
})(NodeType || (exports.NodeType = NodeType = {}));
var MemberRole;
(function (MemberRole) {
    MemberRole["Viewer"] = "viewer";
    MemberRole["Editor"] = "editor";
    MemberRole["Admin"] = "admin";
    MemberRole["Inherited"] = "inherited";
})(MemberRole || (exports.MemberRole = MemberRole = {}));
var RevisionState;
(function (RevisionState) {
    RevisionState["Active"] = "active";
    RevisionState["Superseded"] = "superseded";
})(RevisionState || (exports.RevisionState = RevisionState = {}));
//# sourceMappingURL=nodes.js.map