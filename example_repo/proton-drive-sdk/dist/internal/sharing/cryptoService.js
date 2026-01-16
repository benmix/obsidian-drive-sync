"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingCryptoService = exports.PUBLIC_LINK_GENERATED_PASSWORD_LENGTH = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const ttag_1 = require("ttag");
const crypto_1 = require("../../crypto");
const interface_1 = require("../../interface");
const validations_1 = require("../nodes/validations");
const errors_1 = require("../errors");
const errors_2 = require("../../errors");
// Version 2 of bcrypt with 2**10 rounds.
// https://en.wikipedia.org/wiki/Bcrypt#Description
const BCRYPT_PREFIX = '$2y$10$';
exports.PUBLIC_LINK_GENERATED_PASSWORD_LENGTH = 12;
// We do not support management of legacy public links anymore (that is no
// flag or bit 1). But we still need to support to read the legacy public
// link.
var PublicLinkFlags;
(function (PublicLinkFlags) {
    PublicLinkFlags[PublicLinkFlags["Legacy"] = 0] = "Legacy";
    PublicLinkFlags[PublicLinkFlags["CustomPassword"] = 1] = "CustomPassword";
    PublicLinkFlags[PublicLinkFlags["GeneratedPasswordIncluded"] = 2] = "GeneratedPasswordIncluded";
    PublicLinkFlags[PublicLinkFlags["GeneratedPasswordWithCustomPassword"] = 3] = "GeneratedPasswordWithCustomPassword";
})(PublicLinkFlags || (PublicLinkFlags = {}));
/**
 * Provides crypto operations for sharing.
 *
 * The sharing crypto service is responsible for encrypting and decrypting
 * shares, invitations, etc.
 */
class SharingCryptoService {
    telemetry;
    driveCrypto;
    account;
    sharesService;
    constructor(telemetry, driveCrypto, account, sharesService) {
        this.telemetry = telemetry;
        this.driveCrypto = driveCrypto;
        this.account = account;
        this.sharesService = sharesService;
        this.telemetry = telemetry;
        this.driveCrypto = driveCrypto;
        this.account = account;
        this.sharesService = sharesService;
    }
    /**
     * Generates a share key for a standard share used for sharing with other users.
     *
     * Standard share, in contrast to a root share, is encrypted with node key and
     * can be managed by any admin.
     */
    async generateShareKeys(nodeKeys, addressKey) {
        const shareKey = await this.driveCrypto.generateKey([nodeKeys.key, addressKey], addressKey);
        const { base64KeyPacket: base64PpassphraseKeyPacket } = await this.driveCrypto.encryptSessionKey(nodeKeys.passphraseSessionKey, shareKey.decrypted.key);
        const { base64KeyPacket: base64NameKeyPacket } = await this.driveCrypto.encryptSessionKey(nodeKeys.nameSessionKey, shareKey.decrypted.key);
        return {
            shareKey,
            base64PpassphraseKeyPacket,
            base64NameKeyPacket,
        };
    }
    /**
     * Decrypts a share using the node key.
     *
     * The share is encrypted with the node key and can be managed by any admin.
     *
     * Old shares are encrypted with address key only and thus available only
     * to owners. `decryptShare` automatically tries to decrypt the share with
     * address keys as fallback if available.
     */
    async decryptShare(share, nodeKey) {
        // All standard shares should be encrypted with node key.
        // Using node key is essential so any admin can manage the share.
        // Old shares are encrypted with address key only and thus available
        // only to owners. Adding address keys (if available) is a fallback
        // solution until all shares are migrated.
        const decryptionKeys = [nodeKey];
        if (share.addressId) {
            const address = await this.account.getOwnAddress(share.addressId);
            decryptionKeys.push(...address.keys.map(({ key }) => key));
        }
        const addressPublicKeys = await this.account.getPublicKeys(share.creatorEmail);
        const { key, passphraseSessionKey, verified, verificationErrors } = await this.driveCrypto.decryptKey(share.encryptedCrypto.armoredKey, share.encryptedCrypto.armoredPassphrase, share.encryptedCrypto.armoredPassphraseSignature, decryptionKeys, addressPublicKeys);
        const author = verified === crypto_1.VERIFICATION_STATUS.SIGNED_AND_VALID
            ? (0, interface_1.resultOk)(share.creatorEmail)
            : (0, interface_1.resultError)({
                claimedAuthor: share.creatorEmail,
                error: (0, errors_1.getVerificationMessage)(verified, verificationErrors),
            });
        return {
            author,
            key,
            passphraseSessionKey,
        };
    }
    /**
     * Encrypts an invitation for sharing a node with another user.
     *
     * `inviteeEmail` is used to load public key of the invitee and used to
     * encrypt share's session key. `inviterKey` is used to sign the invitation.
     */
    async encryptInvitation(shareSessionKey, inviterKey, inviteeEmail) {
        const inviteePublicKeys = await this.account.getPublicKeys(inviteeEmail);
        const result = await this.driveCrypto.encryptInvitation(shareSessionKey, inviteePublicKeys[0], inviterKey);
        return result;
    }
    /**
     * Decrypts and verifies an invitation and node's name.
     */
    async decryptInvitationWithNode(encryptedInvitation) {
        const inviteeAddress = await this.account.getOwnAddress(encryptedInvitation.inviteeEmail);
        const inviteeKey = inviteeAddress.keys[inviteeAddress.primaryKeyIndex].key;
        const shareKey = await this.driveCrypto.decryptUnsignedKey(encryptedInvitation.share.armoredKey, encryptedInvitation.share.armoredPassphrase, inviteeKey);
        let nodeName;
        try {
            const result = await this.driveCrypto.decryptNodeName(encryptedInvitation.node.encryptedName, shareKey, []);
            nodeName = (0, interface_1.resultOk)(result.name);
        }
        catch (error) {
            const message = (0, errors_1.getErrorMessage)(error);
            const errorMessage = (0, ttag_1.c)('Error').t `Failed to decrypt item name: ${message}`;
            nodeName = (0, interface_1.resultError)(new Error(errorMessage));
        }
        return {
            ...(await this.decryptInvitation(encryptedInvitation)),
            node: {
                uid: encryptedInvitation.node.uid,
                name: nodeName,
                type: encryptedInvitation.node.type,
                mediaType: encryptedInvitation.node.mediaType,
            },
        };
    }
    /**
     * Verifies an invitation.
     */
    async decryptInvitation(encryptedInvitation) {
        // TODO: verify addedByEmail (current client doesnt do this)
        const addedByEmail = (0, interface_1.resultOk)(encryptedInvitation.addedByEmail);
        return {
            uid: encryptedInvitation.uid,
            invitationTime: encryptedInvitation.invitationTime,
            addedByEmail: addedByEmail,
            inviteeEmail: encryptedInvitation.inviteeEmail,
            role: encryptedInvitation.role,
        };
    }
    /**
     * Accepts an invitation by signing the session key by invitee.
     */
    async acceptInvitation(encryptedInvitation) {
        const inviteeAddress = await this.account.getOwnAddress(encryptedInvitation.inviteeEmail);
        const inviteeKey = inviteeAddress.keys[inviteeAddress.primaryKeyIndex].key;
        const result = await this.driveCrypto.acceptInvitation(encryptedInvitation.base64KeyPacket, inviteeKey);
        return result;
    }
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
    async encryptExternalInvitation(shareSessionKey, inviterKey, inviteeEmail) {
        const result = await this.driveCrypto.encryptExternalInvitation(shareSessionKey, inviterKey, inviteeEmail);
        return result;
    }
    /**
     * Verifies an external invitation.
     */
    async decryptExternalInvitation(encryptedInvitation) {
        // TODO: verify addedByEmail (current client doesnt do this)
        const addedByEmail = (0, interface_1.resultOk)(encryptedInvitation.addedByEmail);
        return {
            uid: encryptedInvitation.uid,
            invitationTime: encryptedInvitation.invitationTime,
            addedByEmail: addedByEmail,
            inviteeEmail: encryptedInvitation.inviteeEmail,
            role: encryptedInvitation.role,
            state: encryptedInvitation.state,
        };
    }
    /**
     * Verifies a member.
     */
    async decryptMember(encryptedMember) {
        // TODO: verify addedByEmail (current client doesnt do this)
        const addedByEmail = (0, interface_1.resultOk)(encryptedMember.addedByEmail);
        return {
            uid: encryptedMember.uid,
            invitationTime: encryptedMember.invitationTime,
            addedByEmail: addedByEmail,
            inviteeEmail: encryptedMember.inviteeEmail,
            role: encryptedMember.role,
        };
    }
    async encryptPublicLink(creatorEmail, shareSessionKey, password) {
        const address = await this.account.getOwnAddress(creatorEmail);
        const addressKey = address.keys[address.primaryKeyIndex].key;
        const { base64Salt: base64SharePasswordSalt, bcryptPassphrase } = await this.computeKeySaltAndPassphrase(password);
        const { base64SharePassphraseKeyPacket, armoredPassword, srp } = await this.driveCrypto.encryptPublicLinkPasswordAndSessionKey(password, addressKey, bcryptPassphrase, shareSessionKey);
        return {
            crypto: {
                base64SharePasswordSalt,
                base64SharePassphraseKeyPacket,
                armoredPassword,
            },
            srp,
        };
    }
    async generatePublicLinkPassword() {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint32Array(exports.PUBLIC_LINK_GENERATED_PASSWORD_LENGTH));
        let result = '';
        for (let i = 0; i < exports.PUBLIC_LINK_GENERATED_PASSWORD_LENGTH; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    }
    async computeKeySaltAndPassphrase(password) {
        if (!password) {
            throw new Error('Password required.');
        }
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await bcryptjs_1.default.hash(password, BCRYPT_PREFIX + bcryptjs_1.default.encodeBase64(salt, 16));
        // Remove bcrypt prefix and salt (first 29 characters)
        const bcryptPassphrase = hash.slice(29);
        return {
            base64Salt: (0, crypto_1.uint8ArrayToBase64String)(salt),
            bcryptPassphrase,
        };
    }
    async decryptPublicLink(encryptedPublicLink) {
        const address = await this.account.getOwnAddress(encryptedPublicLink.creatorEmail);
        const addressKeys = address.keys.map(({ key }) => key);
        const { password, customPassword } = await this.decryptShareUrlPassword(encryptedPublicLink, addressKeys);
        return {
            uid: encryptedPublicLink.uid,
            creationTime: encryptedPublicLink.creationTime,
            expirationTime: encryptedPublicLink.expirationTime,
            role: encryptedPublicLink.role,
            url: `${encryptedPublicLink.publicUrl}#${password}`,
            customPassword,
            creatorEmail: encryptedPublicLink.creatorEmail,
            numberOfInitializedDownloads: encryptedPublicLink.numberOfInitializedDownloads,
        };
    }
    async decryptShareUrlPassword(encryptedPublicLink, addressKeys) {
        const password = await this.driveCrypto.decryptShareUrlPassword(encryptedPublicLink.armoredUrlPassword, addressKeys);
        switch (encryptedPublicLink.flags) {
            // This is legacy that is not supported anymore.
            // Availalbe only for reading.
            case PublicLinkFlags.Legacy:
            case PublicLinkFlags.CustomPassword:
                return {
                    password,
                };
            case PublicLinkFlags.GeneratedPasswordIncluded:
            case PublicLinkFlags.GeneratedPasswordWithCustomPassword:
                return splitGeneratedAndCustomPassword(password);
            default:
                throw new Error(`Unsupported public link with flags: ${encryptedPublicLink.flags}`);
        }
    }
    async decryptBookmark(encryptedBookmark) {
        // TODO: Signatures are not checked and not specified in the interface.
        // In the future, we will need to add authorship verification.
        let password;
        let urlPassword;
        let customPassword;
        try {
            password = await this.decryptBookmarkUrlPassword(encryptedBookmark);
            const result = splitGeneratedAndCustomPassword(password);
            urlPassword = result.password;
            customPassword = (0, interface_1.resultOk)(result.customPassword);
        }
        catch (originalError) {
            const error = originalError instanceof Error ? originalError : new Error((0, ttag_1.c)('Error').t `Unknown error`);
            return {
                url: (0, interface_1.resultError)(error),
                customPassword: (0, interface_1.resultError)(error),
                nodeName: (0, interface_1.resultError)(error),
            };
        }
        // TODO: API should provide the full URL.
        const url = (0, interface_1.resultOk)(`https://drive.proton.me/urls/${encryptedBookmark.tokenId}#${urlPassword}`);
        let shareKey;
        try {
            shareKey = await this.decryptBookmarkKey(encryptedBookmark, password);
        }
        catch (originalError) {
            const error = originalError instanceof Error ? originalError : new Error((0, ttag_1.c)('Error').t `Unknown error`);
            return {
                url,
                customPassword,
                nodeName: (0, interface_1.resultError)(error),
            };
        }
        const nodeName = await this.decryptBookmarkName(encryptedBookmark, shareKey);
        return {
            url,
            customPassword,
            nodeName,
        };
    }
    async decryptBookmarkUrlPassword(encryptedBookmark) {
        if (!encryptedBookmark.url.encryptedUrlPassword) {
            throw new Error((0, ttag_1.c)('Error').t `Bookmark password is not available`);
        }
        const { addressId } = await this.sharesService.getMyFilesShareMemberEmailKey();
        const address = await this.account.getOwnAddress(addressId);
        const addressKeys = address.keys.map(({ key }) => key);
        try {
            // Decrypt the password for the share URL.
            const urlPassword = await this.driveCrypto.decryptShareUrlPassword(encryptedBookmark.url.encryptedUrlPassword, addressKeys);
            return urlPassword;
        }
        catch (error) {
            this.telemetry.recordMetric({
                eventName: 'decryptionError',
                volumeType: interface_1.MetricVolumeType.SharedPublic,
                field: 'shareUrlPassword',
                error,
                uid: encryptedBookmark.tokenId,
            });
            const message = (0, errors_1.getErrorMessage)(error);
            const errorMessage = (0, ttag_1.c)('Error').t `Failed to decrypt bookmark password: ${message}`;
            throw new errors_2.DecryptionError(errorMessage, { cause: error });
        }
    }
    async decryptBookmarkKey(encryptedBookmark, password) {
        try {
            // Use the password to decrypt the share key.
            const { key: shareKey } = await this.driveCrypto.decryptKeyWithSrpPassword(password, encryptedBookmark.url.base64SharePasswordSalt, encryptedBookmark.share.armoredKey, encryptedBookmark.share.armoredPassphrase);
            return shareKey;
        }
        catch (error) {
            this.telemetry.recordMetric({
                eventName: 'decryptionError',
                volumeType: interface_1.MetricVolumeType.SharedPublic,
                field: 'shareKey',
                error,
                uid: encryptedBookmark.tokenId,
            });
            const message = (0, errors_1.getErrorMessage)(error);
            const errorMessage = (0, ttag_1.c)('Error').t `Failed to decrypt bookmark key: ${message}`;
            throw new errors_2.DecryptionError(errorMessage, { cause: error });
        }
    }
    async decryptBookmarkName(encryptedBookmark, shareKey) {
        try {
            // Use the share key to decrypt the node name of the bookmark.
            const { name } = await this.driveCrypto.decryptNodeName(encryptedBookmark.node.encryptedName, shareKey, []);
            try {
                (0, validations_1.validateNodeName)(name);
            }
            catch (error) {
                return (0, interface_1.resultError)({
                    name,
                    error: error instanceof Error ? error.message : (0, ttag_1.c)('Error').t `Unknown error`,
                });
            }
            return (0, interface_1.resultOk)(name);
        }
        catch (error) {
            this.telemetry.recordMetric({
                eventName: 'decryptionError',
                volumeType: interface_1.MetricVolumeType.SharedPublic,
                field: 'nodeName',
                error,
                uid: encryptedBookmark.tokenId,
            });
            const message = (0, errors_1.getErrorMessage)(error);
            const errorMessage = (0, ttag_1.c)('Error').t `Failed to decrypt bookmark name: ${message}`;
            return (0, interface_1.resultError)(new Error(errorMessage));
        }
    }
}
exports.SharingCryptoService = SharingCryptoService;
function splitGeneratedAndCustomPassword(concatenatedPassword) {
    const password = concatenatedPassword.substring(0, exports.PUBLIC_LINK_GENERATED_PASSWORD_LENGTH);
    const customPassword = concatenatedPassword.substring(exports.PUBLIC_LINK_GENERATED_PASSWORD_LENGTH) || undefined;
    return { password, customPassword };
}
//# sourceMappingURL=cryptoService.js.map