"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeDeviceUid = makeDeviceUid;
exports.splitDeviceUid = splitDeviceUid;
exports.makeNodeUid = makeNodeUid;
exports.splitNodeUid = splitNodeUid;
exports.makeNodeRevisionUid = makeNodeRevisionUid;
exports.splitNodeRevisionUid = splitNodeRevisionUid;
exports.makeNodeUidFromRevisionUid = makeNodeUidFromRevisionUid;
exports.makeNodeThumbnailUid = makeNodeThumbnailUid;
exports.splitNodeThumbnailUid = splitNodeThumbnailUid;
exports.makeInvitationUid = makeInvitationUid;
exports.splitInvitationUid = splitInvitationUid;
exports.makeMemberUid = makeMemberUid;
exports.splitMemberUid = splitMemberUid;
exports.makePublicLinkUid = makePublicLinkUid;
exports.splitPublicLinkUid = splitPublicLinkUid;
function makeDeviceUid(volumeId, deviceId) {
    return `${volumeId}~${deviceId}`;
}
function splitDeviceUid(deviceUid) {
    const parts = deviceUid.split('~');
    if (parts.length !== 2) {
        throw new Error(`"${deviceUid}" is not valid device UID`);
    }
    const [volumeId, deviceId] = parts;
    return { volumeId, deviceId };
}
function makeNodeUid(volumeId, nodeId) {
    return makeUid(volumeId, nodeId);
}
function splitNodeUid(nodeUid) {
    const [volumeId, nodeId] = splitUid(nodeUid, 2, 'node');
    return { volumeId, nodeId };
}
function makeNodeRevisionUid(volumeId, nodeId, revisionId) {
    return makeUid(volumeId, nodeId, revisionId);
}
function splitNodeRevisionUid(nodeRevisionUid) {
    const [volumeId, nodeId, revisionId] = splitUid(nodeRevisionUid, 3, 'revision');
    return { volumeId, nodeId, revisionId };
}
function makeNodeUidFromRevisionUid(nodeRevisionUid) {
    const { volumeId, nodeId } = splitNodeRevisionUid(nodeRevisionUid);
    return makeNodeUid(volumeId, nodeId);
}
function makeNodeThumbnailUid(volumeId, nodeId, thumbnailId) {
    return makeUid(volumeId, nodeId, thumbnailId);
}
function splitNodeThumbnailUid(nodeThumbnailUid) {
    const [volumeId, nodeId, thumbnailId] = splitUid(nodeThumbnailUid, 3, 'thumbnail');
    return { volumeId, nodeId, thumbnailId };
}
function makeInvitationUid(shareId, invitationId) {
    return makeUid(shareId, invitationId);
}
function splitInvitationUid(invitationUid) {
    const [shareId, invitationId] = splitUid(invitationUid, 2, 'invitation');
    return { shareId, invitationId };
}
function makeMemberUid(shareId, memberId) {
    return makeUid(shareId, memberId);
}
function splitMemberUid(memberUid) {
    const [shareId, memberId] = splitUid(memberUid, 2, 'member');
    return { shareId, memberId };
}
function makePublicLinkUid(shareId, publicLinkId) {
    return makeUid(shareId, publicLinkId);
}
function splitPublicLinkUid(publicLinkUid) {
    const [shareId, publicLinkId] = splitUid(publicLinkUid, 2, 'public link');
    return { shareId, publicLinkId };
}
function makeUid(...parts) {
    return parts.join('~');
}
function splitUid(uid, expectedParts, typeName) {
    const parts = uid.split('~');
    if (parts.length !== expectedParts) {
        throw new Error(`"${uid}" is not a valid ${typeName} UID`);
    }
    return parts;
}
//# sourceMappingURL=uids.js.map