import { SRPVerifier } from '../../crypto';
import { MemberRole, Logger } from '../../interface';
import { DriveAPIService } from '../apiService';
import { ShareTargetType } from '../shares';
import { EncryptedInvitationRequest, EncryptedInvitation, EncryptedInvitationWithNode, EncryptedExternalInvitation, EncryptedMember, EncryptedBookmark, EncryptedExternalInvitationRequest, EncryptedPublicLink, EncryptedPublicLinkCrypto } from './interface';
/**
 * Provides API communication for fetching and managing sharing.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
export declare class SharingAPIService {
    private logger;
    private apiService;
    private shareTargetTypes;
    constructor(logger: Logger, apiService: DriveAPIService, shareTargetTypes: ShareTargetType[]);
    iterateSharedNodeUids(volumeId: string, signal?: AbortSignal): AsyncGenerator<string>;
    iterateSharedWithMeNodeUids(signal?: AbortSignal): AsyncGenerator<string>;
    iterateInvitationUids(signal?: AbortSignal): AsyncGenerator<string>;
    getInvitation(invitationUid: string): Promise<EncryptedInvitationWithNode>;
    acceptInvitation(invitationUid: string, base64SessionKeySignature: string): Promise<void>;
    rejectInvitation(invitationUid: string): Promise<void>;
    iterateBookmarks(signal?: AbortSignal): AsyncGenerator<EncryptedBookmark>;
    deleteBookmark(tokenId: string): Promise<void>;
    getShareInvitations(shareId: string): Promise<EncryptedInvitation[]>;
    getShareExternalInvitations(shareId: string): Promise<EncryptedExternalInvitation[]>;
    getShareMembers(shareId: string): Promise<EncryptedMember[]>;
    createStandardShare(nodeUid: string, addressId: string, shareKey: {
        armoredKey: string;
        armoredPassphrase: string;
        armoredPassphraseSignature: string;
    }, node: {
        base64PassphraseKeyPacket: string;
        base64NameKeyPacket: string;
    }): Promise<string>;
    deleteShare(shareId: string, force?: boolean): Promise<void>;
    inviteProtonUser(shareId: string, invitation: EncryptedInvitationRequest, emailDetails?: {
        message?: string;
        nodeName?: string;
    }): Promise<EncryptedInvitation>;
    updateInvitation(invitationUid: string, invitation: {
        role: MemberRole;
    }): Promise<void>;
    resendInvitationEmail(invitationUid: string): Promise<void>;
    deleteInvitation(invitationUid: string): Promise<void>;
    inviteExternalUser(shareId: string, invitation: EncryptedExternalInvitationRequest, emailDetails?: {
        message?: string;
        nodeName?: string;
    }): Promise<EncryptedExternalInvitation>;
    updateExternalInvitation(invitationUid: string, invitation: {
        role: MemberRole;
    }): Promise<void>;
    resendExternalInvitationEmail(invitationUid: string): Promise<void>;
    deleteExternalInvitation(invitationUid: string): Promise<void>;
    updateMember(memberUid: string, member: {
        role: MemberRole;
    }): Promise<void>;
    removeMember(memberUid: string): Promise<void>;
    getPublicLink(shareId: string): Promise<EncryptedPublicLink | undefined>;
    createPublicLink(shareId: string, publicLink: {
        creatorEmail: string;
        role: MemberRole;
        includesCustomPassword: boolean;
        expirationTime?: number;
        crypto: EncryptedPublicLinkCrypto;
        srp: SRPVerifier;
    }): Promise<{
        uid: string;
        publicUrl: string;
    }>;
    updatePublicLink(publicLinkUid: string, publicLink: {
        role: MemberRole;
        includesCustomPassword: boolean;
        expirationTime?: number;
        crypto: EncryptedPublicLinkCrypto;
        srp: SRPVerifier;
    }): Promise<void>;
    private generatePublicLinkRequestPayload;
    removePublicLink(publicLinkUid: string): Promise<void>;
    private convertInternalInvitation;
    private convertExternalInvitaiton;
}
