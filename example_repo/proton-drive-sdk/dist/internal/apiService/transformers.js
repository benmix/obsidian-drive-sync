"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeTypeNumberToNodeType = nodeTypeNumberToNodeType;
exports.permissionsToMemberRole = permissionsToMemberRole;
exports.memberRoleToPermission = memberRoleToPermission;
const interface_1 = require("../../interface");
function nodeTypeNumberToNodeType(logger, nodeTypeNumber) {
    switch (nodeTypeNumber) {
        case 1:
            return interface_1.NodeType.Folder;
        case 2:
            return interface_1.NodeType.File;
        case 3:
            return interface_1.NodeType.Album;
        default:
            logger.warn(`Unknown node type: ${nodeTypeNumber}`);
            return interface_1.NodeType.File;
    }
}
function permissionsToMemberRole(logger, permissionsNumber) {
    switch (permissionsNumber) {
        case undefined:
            return interface_1.MemberRole.Inherited;
        case 4:
            return interface_1.MemberRole.Viewer;
        case 6:
            return interface_1.MemberRole.Editor;
        case 22:
            return interface_1.MemberRole.Admin;
        default:
            // User have access to the data, thus at minimum it can view.
            logger.warn(`Unknown sharing permissions: ${permissionsNumber}`);
            return interface_1.MemberRole.Viewer;
    }
}
function memberRoleToPermission(memberRole) {
    if (memberRole === interface_1.MemberRole.Inherited) {
        // This is developer error.
        throw new Error('Cannot convert inherited role to permission');
    }
    switch (memberRole) {
        case interface_1.MemberRole.Viewer:
            return 4;
        case interface_1.MemberRole.Editor:
            return 6;
        case interface_1.MemberRole.Admin:
            return 22;
    }
}
//# sourceMappingURL=transformers.js.map