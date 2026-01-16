"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingAPIService = void 0;
const interface_1 = require("../../interface");
const apiService_1 = require("../apiService");
const uids_1 = require("../uids");
/**
 * Provides API communication for fetching and managing sharing.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
class SharingAPIService {
    logger;
    apiService;
    shareTargetTypes;
    constructor(logger, apiService, shareTargetTypes) {
        this.logger = logger;
        this.apiService = apiService;
        this.shareTargetTypes = shareTargetTypes;
        this.logger = logger;
        this.apiService = apiService;
        this.shareTargetTypes = shareTargetTypes;
    }
    async *iterateSharedNodeUids(volumeId, signal) {
        let anchor = '';
        while (true) {
            const response = await this.apiService.get(`drive/v2/volumes/${volumeId}/shares?${anchor ? `AnchorID=${anchor}` : ''}`, signal);
            for (const link of response.Links) {
                yield (0, uids_1.makeNodeUid)(volumeId, link.LinkID);
            }
            if (!response.More || !response.AnchorID) {
                break;
            }
            anchor = response.AnchorID;
        }
    }
    async *iterateSharedWithMeNodeUids(signal) {
        let anchor = '';
        while (true) {
            // TODO: Use ShareTargetTypes filter when it is supported by the API.
            const response = await this.apiService.get(`drive/v2/sharedwithme?${anchor ? `AnchorID=${anchor}` : ''}`, signal);
            for (const link of response.Links) {
                const nodeUid = (0, uids_1.makeNodeUid)(link.VolumeID, link.LinkID);
                if (!this.shareTargetTypes.includes(link.ShareTargetType)) {
                    this.logger.debug(`Unsupported share target type ${link.ShareTargetType} for node ${nodeUid}`);
                    continue;
                }
                yield nodeUid;
            }
            if (!response.More || !response.AnchorID) {
                break;
            }
            anchor = response.AnchorID;
        }
    }
    async *iterateInvitationUids(signal) {
        let anchor = '';
        while (true) {
            const params = new URLSearchParams();
            this.shareTargetTypes.forEach((type) => {
                params.append('ShareTargetTypes[]', type.toString());
            });
            if (anchor) {
                params.append('AnchorID', anchor);
            }
            const response = await this.apiService.get(`drive/v2/shares/invitations?${params.toString()}`, signal);
            for (const invitation of response.Invitations) {
                const invitationUid = (0, uids_1.makeInvitationUid)(invitation.ShareID, invitation.InvitationID);
                if (!this.shareTargetTypes.includes(invitation.ShareTargetType)) {
                    this.logger.warn(`Unsupported share target type ${invitation.ShareTargetType} for invitation ${invitationUid}`);
                    continue;
                }
                yield invitationUid;
            }
            if (!response.More || !response.AnchorID) {
                break;
            }
            anchor = response.AnchorID;
        }
    }
    async getInvitation(invitationUid) {
        const { invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        const response = await this.apiService.get(`drive/v2/shares/invitations/${invitationId}`);
        return {
            uid: invitationUid,
            addedByEmail: response.Invitation.InviterEmail,
            inviteeEmail: response.Invitation.InviteeEmail,
            base64KeyPacket: response.Invitation.KeyPacket,
            base64KeyPacketSignature: response.Invitation.KeyPacketSignature,
            invitationTime: new Date(response.Invitation.CreateTime * 1000),
            role: (0, apiService_1.permissionsToMemberRole)(this.logger, response.Invitation.Permissions),
            share: {
                armoredKey: response.Share.ShareKey,
                armoredPassphrase: response.Share.Passphrase,
                creatorEmail: response.Share.CreatorEmail,
            },
            node: {
                uid: (0, uids_1.makeNodeUid)(response.Share.VolumeID, response.Link.LinkID),
                type: (0, apiService_1.nodeTypeNumberToNodeType)(this.logger, response.Link.Type),
                mediaType: response.Link.MIMEType || undefined,
                encryptedName: response.Link.Name,
            },
        };
    }
    async acceptInvitation(invitationUid, base64SessionKeySignature) {
        const { invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        await this.apiService.post(`drive/v2/shares/invitations/${invitationId}/accept`, {
            SessionKeySignature: base64SessionKeySignature,
        });
    }
    async rejectInvitation(invitationUid) {
        const { invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        await this.apiService.post(`drive/v2/shares/invitations/${invitationId}/reject`);
    }
    async *iterateBookmarks(signal) {
        const response = await this.apiService.get(`drive/v2/shared-bookmarks`, signal);
        for (const bookmark of response.Bookmarks) {
            yield {
                tokenId: bookmark.Token.Token,
                creationTime: new Date(bookmark.CreateTime * 1000),
                share: {
                    armoredKey: bookmark.Token.ShareKey,
                    armoredPassphrase: bookmark.Token.SharePassphrase,
                },
                url: {
                    encryptedUrlPassword: bookmark.EncryptedUrlPassword || undefined,
                    base64SharePasswordSalt: bookmark.Token.SharePasswordSalt,
                },
                node: {
                    type: bookmark.Token.LinkType === 1 ? interface_1.NodeType.Folder : interface_1.NodeType.File,
                    mediaType: bookmark.Token.MIMEType,
                    encryptedName: bookmark.Token.Name,
                    armoredKey: bookmark.Token.NodeKey,
                    armoredNodePassphrase: bookmark.Token.NodePassphrase,
                    file: {
                        base64ContentKeyPacket: bookmark.Token.ContentKeyPacket || undefined,
                    },
                },
            };
        }
    }
    async deleteBookmark(tokenId) {
        await this.apiService.delete(`drive/v2/urls/${tokenId}/bookmark`);
    }
    async getShareInvitations(shareId) {
        const response = await this.apiService.get(`drive/v2/shares/${shareId}/invitations`);
        return response.Invitations.map((invitation) => {
            return this.convertInternalInvitation(shareId, invitation);
        });
    }
    async getShareExternalInvitations(shareId) {
        const response = await this.apiService.get(`drive/v2/shares/${shareId}/external-invitations`);
        return response.ExternalInvitations.map((invitation) => {
            return this.convertExternalInvitaiton(shareId, invitation);
        });
    }
    async getShareMembers(shareId) {
        const response = await this.apiService.get(`drive/v2/shares/${shareId}/members`);
        return response.Members.map((member) => {
            return {
                uid: (0, uids_1.makeMemberUid)(shareId, member.MemberID),
                addedByEmail: member.InviterEmail,
                inviteeEmail: member.Email,
                base64KeyPacket: member.KeyPacket,
                base64KeyPacketSignature: member.KeyPacketSignature,
                invitationTime: new Date(member.CreateTime * 1000),
                role: (0, apiService_1.permissionsToMemberRole)(this.logger, member.Permissions),
            };
        });
    }
    async createStandardShare(nodeUid, addressId, shareKey, node) {
        const { volumeId, nodeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const response = await this.apiService.post(`drive/volumes/${volumeId}/shares`, {
            RootLinkID: nodeId,
            AddressID: addressId,
            Name: 'New Share',
            ShareKey: shareKey.armoredKey,
            SharePassphrase: shareKey.armoredPassphrase,
            SharePassphraseSignature: shareKey.armoredPassphraseSignature,
            PassphraseKeyPacket: node.base64PassphraseKeyPacket,
            NameKeyPacket: node.base64NameKeyPacket,
        });
        return response.Share.ID;
    }
    async deleteShare(shareId, force = false) {
        await this.apiService.delete(`drive/shares/${shareId}?Force=${force ? 1 : 0}`);
    }
    async inviteProtonUser(shareId, invitation, emailDetails = {}) {
        const response = await this.apiService.post(`drive/v2/shares/${shareId}/invitations`, {
            Invitation: {
                InviterEmail: invitation.addedByEmail,
                InviteeEmail: invitation.inviteeEmail,
                Permissions: (0, apiService_1.memberRoleToPermission)(invitation.role),
                KeyPacket: invitation.base64KeyPacket,
                KeyPacketSignature: invitation.base64KeyPacketSignature,
                ExternalInvitationID: null,
            },
            EmailDetails: {
                Message: emailDetails.message,
                ItemName: emailDetails.nodeName,
            },
        });
        return this.convertInternalInvitation(shareId, response.Invitation);
    }
    async updateInvitation(invitationUid, invitation) {
        const { shareId, invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        await this.apiService.put(`drive/v2/shares/${shareId}/invitations/${invitationId}`, {
            Permissions: (0, apiService_1.memberRoleToPermission)(invitation.role),
        });
    }
    async resendInvitationEmail(invitationUid) {
        const { shareId, invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        await this.apiService.post(`drive/v2/shares/${shareId}/invitations/${invitationId}/sendemail`);
    }
    async deleteInvitation(invitationUid) {
        const { shareId, invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        await this.apiService.delete(`drive/v2/shares/${shareId}/invitations/${invitationId}`);
    }
    async inviteExternalUser(shareId, invitation, emailDetails = {}) {
        const response = await this.apiService.post(`drive/v2/shares/${shareId}/external-invitations`, {
            ExternalInvitation: {
                InviterAddressID: invitation.inviterAddressId,
                InviteeEmail: invitation.inviteeEmail,
                Permissions: (0, apiService_1.memberRoleToPermission)(invitation.role),
                ExternalInvitationSignature: invitation.base64Signature,
            },
            EmailDetails: {
                Message: emailDetails.message,
                ItemName: emailDetails.nodeName,
            },
        });
        return this.convertExternalInvitaiton(shareId, response.ExternalInvitation);
    }
    async updateExternalInvitation(invitationUid, invitation) {
        const { shareId, invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        await this.apiService.put(`drive/v2/shares/${shareId}/external-invitations/${invitationId}`, {
            Permissions: (0, apiService_1.memberRoleToPermission)(invitation.role),
        });
    }
    async resendExternalInvitationEmail(invitationUid) {
        const { shareId, invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        await this.apiService.post(`drive/v2/shares/${shareId}/external-invitations/${invitationId}/sendemail`);
    }
    async deleteExternalInvitation(invitationUid) {
        const { shareId, invitationId } = (0, uids_1.splitInvitationUid)(invitationUid);
        await this.apiService.delete(`drive/v2/shares/${shareId}/external-invitations/${invitationId}`);
    }
    async updateMember(memberUid, member) {
        const { shareId, memberId } = (0, uids_1.splitMemberUid)(memberUid);
        await this.apiService.put(`drive/v2/shares/${shareId}/members/${memberId}`, {
            Permissions: (0, apiService_1.memberRoleToPermission)(member.role),
        });
    }
    async removeMember(memberUid) {
        const { shareId, memberId } = (0, uids_1.splitMemberUid)(memberUid);
        await this.apiService.delete(`drive/v2/shares/${shareId}/members/${memberId}`);
    }
    async getPublicLink(shareId) {
        const response = await this.apiService.get(`drive/shares/${shareId}/urls`);
        if (!response.ShareURLs || response.ShareURLs.length === 0) {
            return undefined;
        }
        if (response.ShareURLs.length > 1) {
            this.logger.warn('Multiple share URLs found, using the first one');
        }
        const shareUrl = response.ShareURLs[0];
        return {
            uid: (0, uids_1.makePublicLinkUid)(shareUrl.ShareID, shareUrl.ShareURLID),
            creationTime: new Date(shareUrl.CreateTime * 1000),
            expirationTime: shareUrl.ExpirationTime ? new Date(shareUrl.ExpirationTime * 1000) : undefined,
            role: (0, apiService_1.permissionsToMemberRole)(this.logger, shareUrl.Permissions),
            flags: shareUrl.Flags,
            creatorEmail: shareUrl.CreatorEmail,
            publicUrl: shareUrl.PublicUrl,
            numberOfInitializedDownloads: shareUrl.NumAccesses,
            armoredUrlPassword: shareUrl.Password,
            urlPasswordSalt: shareUrl.UrlPasswordSalt,
            base64SharePassphraseKeyPacket: shareUrl.SharePassphraseKeyPacket,
            sharePassphraseSalt: shareUrl.SharePasswordSalt,
        };
    }
    async createPublicLink(shareId, publicLink) {
        if (publicLink.role === interface_1.MemberRole.Admin) {
            throw new Error('Cannot set admin role for public link.');
        }
        const result = await this.apiService.post(`drive/shares/${shareId}/urls`, {
            CreatorEmail: publicLink.creatorEmail,
            ...this.generatePublicLinkRequestPayload(publicLink),
        });
        return {
            uid: (0, uids_1.makePublicLinkUid)(shareId, result.ShareURL.ShareURLID),
            publicUrl: result.ShareURL.PublicUrl,
        };
    }
    async updatePublicLink(publicLinkUid, publicLink) {
        if (publicLink.role === interface_1.MemberRole.Admin) {
            throw new Error('Cannot set admin role for public link.');
        }
        const { shareId, publicLinkId } = (0, uids_1.splitPublicLinkUid)(publicLinkUid);
        await this.apiService.put(`drive/shares/${shareId}/urls/${publicLinkId}`, this.generatePublicLinkRequestPayload(publicLink));
    }
    generatePublicLinkRequestPayload(publicLink) {
        return {
            Permissions: (0, apiService_1.memberRoleToPermission)(publicLink.role),
            Flags: publicLink.includesCustomPassword
                ? 3 // Random + custom password set.
                : 2, // Random password set.
            ExpirationTime: publicLink.expirationTime || null,
            SharePasswordSalt: publicLink.crypto.base64SharePasswordSalt,
            SharePassphraseKeyPacket: publicLink.crypto.base64SharePassphraseKeyPacket,
            Password: publicLink.crypto.armoredPassword,
            UrlPasswordSalt: publicLink.srp.salt,
            SRPVerifier: publicLink.srp.verifier,
            SRPModulusID: publicLink.srp.modulusId,
            MaxAccesses: 0, // We don't support setting limit.
        };
    }
    async removePublicLink(publicLinkUid) {
        const { shareId, publicLinkId } = (0, uids_1.splitPublicLinkUid)(publicLinkUid);
        await this.apiService.delete(`drive/shares/${shareId}/urls/${publicLinkId}`);
    }
    convertInternalInvitation(shareId, invitation) {
        return {
            uid: (0, uids_1.makeInvitationUid)(shareId, invitation.InvitationID),
            addedByEmail: invitation.InviterEmail,
            inviteeEmail: invitation.InviteeEmail,
            invitationTime: new Date(invitation.CreateTime * 1000),
            role: (0, apiService_1.permissionsToMemberRole)(this.logger, invitation.Permissions),
            base64KeyPacket: invitation.KeyPacket,
            base64KeyPacketSignature: invitation.KeyPacketSignature,
        };
    }
    convertExternalInvitaiton(shareId, invitation) {
        const state = invitation.State === 1 ? interface_1.NonProtonInvitationState.Pending : interface_1.NonProtonInvitationState.UserRegistered;
        return {
            uid: (0, uids_1.makeInvitationUid)(shareId, invitation.ExternalInvitationID),
            addedByEmail: invitation.InviterEmail,
            inviteeEmail: invitation.InviteeEmail,
            invitationTime: new Date(invitation.CreateTime * 1000),
            role: (0, apiService_1.permissionsToMemberRole)(this.logger, invitation.Permissions),
            base64Signature: invitation.ExternalInvitationSignature,
            state,
        };
    }
}
exports.SharingAPIService = SharingAPIService;
//# sourceMappingURL=apiService.js.map