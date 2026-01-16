export declare function makeDeviceUid(volumeId: string, deviceId: string): string;
export declare function splitDeviceUid(deviceUid: string): {
    volumeId: string;
    deviceId: string;
};
export declare function makeNodeUid(volumeId: string, nodeId: string): string;
export declare function splitNodeUid(nodeUid: string): {
    volumeId: string;
    nodeId: string;
};
export declare function makeNodeRevisionUid(volumeId: string, nodeId: string, revisionId: string): string;
export declare function splitNodeRevisionUid(nodeRevisionUid: string): {
    volumeId: string;
    nodeId: string;
    revisionId: string;
};
export declare function makeNodeUidFromRevisionUid(nodeRevisionUid: string): string;
export declare function makeNodeThumbnailUid(volumeId: string, nodeId: string, thumbnailId: string): string;
export declare function splitNodeThumbnailUid(nodeThumbnailUid: string): {
    volumeId: string;
    nodeId: string;
    thumbnailId: string;
};
export declare function makeInvitationUid(shareId: string, invitationId: string): string;
export declare function splitInvitationUid(invitationUid: string): {
    shareId: string;
    invitationId: string;
};
export declare function makeMemberUid(shareId: string, memberId: string): string;
export declare function splitMemberUid(memberUid: string): {
    shareId: string;
    memberId: string;
};
export declare function makePublicLinkUid(shareId: string, publicLinkId: string): string;
export declare function splitPublicLinkUid(publicLinkUid: string): {
    shareId: string;
    publicLinkId: string;
};
