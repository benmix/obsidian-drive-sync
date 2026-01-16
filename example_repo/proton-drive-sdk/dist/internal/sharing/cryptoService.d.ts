import { DriveCrypto, PrivateKey, SessionKey, SRPVerifier } from '../../crypto';
import { ProtonDriveAccount, ProtonInvitation, ProtonInvitationWithNode, NonProtonInvitation, Author, Result, Member, InvalidNameError, ProtonDriveTelemetry } from '../../interface';
import { EncryptedShare } from '../shares';
import { EncryptedInvitation, EncryptedInvitationWithNode, EncryptedExternalInvitation, EncryptedMember, EncryptedPublicLink, PublicLinkWithCreatorEmail, EncryptedBookmark, SharesService } from './interface';
export declare const PUBLIC_LINK_GENERATED_PASSWORD_LENGTH = 12;
/**
 * Provides crypto operations for sharing.
 *
 * The sharing crypto service is responsible for encrypting and decrypting
 * shares, invitations, etc.
 */
export declare class SharingCryptoService {
    private telemetry;
    private driveCrypto;
    private account;
    private sharesService;
    constructor(telemetry: ProtonDriveTelemetry, driveCrypto: DriveCrypto, account: ProtonDriveAccount, sharesService: SharesService);
    /**
     * Generates a share key for a standard share used for sharing with other users.
     *
     * Standard share, in contrast to a root share, is encrypted with node key and
     * can be managed by any admin.
     */
    generateShareKeys(nodeKeys: {
        key: PrivateKey;
        passphraseSessionKey: SessionKey;
        nameSessionKey: SessionKey;
    }, addressKey: PrivateKey): Promise<{
        shareKey: {
            encrypted: {
                armoredKey: string;
                armoredPassphrase: string;
                armoredPassphraseSignature: string;
            };
            decrypted: {
                key: PrivateKey;
                passphraseSessionKey: SessionKey;
            };
        };
        base64PpassphraseKeyPacket: string;
        base64NameKeyPacket: string;
    }>;
    /**
     * Decrypts a share using the node key.
     *
     * The share is encrypted with the node key and can be managed by any admin.
     *
     * Old shares are encrypted with address key only and thus available only
     * to owners. `decryptShare` automatically tries to decrypt the share with
     * address keys as fallback if available.
     */
    decryptShare(share: EncryptedShare, nodeKey: PrivateKey): Promise<{
        author: Author;
        key: PrivateKey;
        passphraseSessionKey: SessionKey;
    }>;
    /**
     * Encrypts an invitation for sharing a node with another user.
     *
     * `inviteeEmail` is used to load public key of the invitee and used to
     * encrypt share's session key. `inviterKey` is used to sign the invitation.
     */
    encryptInvitation(shareSessionKey: SessionKey, inviterKey: PrivateKey, inviteeEmail: string): Promise<{
        base64KeyPacket: string;
        base64KeyPacketSignature: string;
    }>;
    /**
     * Decrypts and verifies an invitation and node's name.
     */
    decryptInvitationWithNode(encryptedInvitation: EncryptedInvitationWithNode): Promise<ProtonInvitationWithNode>;
    /**
     * Verifies an invitation.
     */
    decryptInvitation(encryptedInvitation: EncryptedInvitation): Promise<ProtonInvitation>;
    /**
     * Accepts an invitation by signing the session key by invitee.
     */
    acceptInvitation(encryptedInvitation: EncryptedInvitationWithNode): Promise<{
        base64SessionKeySignature: string;
    }>;
    /**
     * Encrypts an external invitation for sharing a node with another user.
     *
     * `inviteeEmail` is used to sign the invitation with `inviterKey`.
     *
     * External invitations are used to share nodes with users who are not
     * registered with Proton Drive. The external invitation then requires
     * the invitee to sign up to create key. Then it can be followed by
     * regular invitation flow.
     */
    encryptExternalInvitation(shareSessionKey: SessionKey, inviterKey: PrivateKey, inviteeEmail: string): Promise<{
        base64ExternalInvitationSignature: string;
    }>;
    /**
     * Verifies an external invitation.
     */
    decryptExternalInvitation(encryptedInvitation: EncryptedExternalInvitation): Promise<NonProtonInvitation>;
    /**
     * Verifies a member.
     */
    decryptMember(encryptedMember: EncryptedMember): Promise<Member>;
    encryptPublicLink(creatorEmail: string, shareSessionKey: SessionKey, password: string): Promise<{
        crypto: {
            base64SharePasswordSalt: string;
            base64SharePassphraseKeyPacket: string;
            armoredPassword: string;
        };
        srp: SRPVerifier;
    }>;
    generatePublicLinkPassword(): Promise<string>;
    private computeKeySaltAndPassphrase;
    decryptPublicLink(encryptedPublicLink: EncryptedPublicLink): Promise<PublicLinkWithCreatorEmail>;
    private decryptShareUrlPassword;
    decryptBookmark(encryptedBookmark: EncryptedBookmark): Promise<{
        url: Result<string, Error>;
        customPassword: Result<string | undefined, Error>;
        nodeName: Result<string, Error | InvalidNameError>;
    }>;
    private decryptBookmarkUrlPassword;
    private decryptBookmarkKey;
    private decryptBookmarkName;
}
