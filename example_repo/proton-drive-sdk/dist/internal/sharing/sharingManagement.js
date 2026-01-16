"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingManagement = void 0;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
const interface_1 = require("../../interface");
const uids_1 = require("../uids");
const errors_2 = require("../errors");
const cryptoService_1 = require("./cryptoService");
/**
 * Provides high-level actions for managing sharing.
 *
 * The manager is responsible for sharing and unsharing nodes, and providing
 * sharing details of nodes.
 */
class SharingManagement {
    logger;
    apiService;
    cache;
    cryptoService;
    account;
    sharesService;
    nodesService;
    constructor(logger, apiService, cache, cryptoService, account, sharesService, nodesService) {
        this.logger = logger;
        this.apiService = apiService;
        this.cache = cache;
        this.cryptoService = cryptoService;
        this.account = account;
        this.sharesService = sharesService;
        this.nodesService = nodesService;
        this.logger = logger;
        this.apiService = apiService;
        this.cache = cache;
        this.cryptoService = cryptoService;
        this.account = account;
        this.sharesService = sharesService;
        this.nodesService = nodesService;
    }
    async getSharingInfo(nodeUid) {
        const node = await this.nodesService.getNode(nodeUid);
        if (!node.shareId) {
            return;
        }
        const [protonInvitations, nonProtonInvitations, members, publicLink] = await Promise.all([
            Array.fromAsync(this.iterateShareInvitations(node.shareId)),
            Array.fromAsync(this.iterateShareExternalInvitations(node.shareId)),
            Array.fromAsync(this.iterateShareMembers(node.shareId)),
            this.getPublicLink(node.shareId),
        ]);
        return {
            protonInvitations,
            nonProtonInvitations,
            members,
            publicLink,
        };
    }
    async *iterateShareInvitations(shareId) {
        const invitations = await this.apiService.getShareInvitations(shareId);
        for (const invitation of invitations) {
            yield this.cryptoService.decryptInvitation(invitation);
        }
    }
    async *iterateShareExternalInvitations(shareId) {
        const invitations = await this.apiService.getShareExternalInvitations(shareId);
        for (const invitation of invitations) {
            yield this.cryptoService.decryptExternalInvitation(invitation);
        }
    }
    async *iterateShareMembers(shareId) {
        const members = await this.apiService.getShareMembers(shareId);
        for (const member of members) {
            yield this.cryptoService.decryptMember(member);
        }
    }
    async getPublicLink(shareId) {
        const encryptedPublicLink = await this.apiService.getPublicLink(shareId);
        if (!encryptedPublicLink) {
            return;
        }
        return this.cryptoService.decryptPublicLink(encryptedPublicLink);
    }
    async shareNode(nodeUid, settings) {
        // Check what users are Proton users before creating share
        // so if this fails, we don't create empty share.
        const protonUsers = [];
        const nonProtonUsers = [];
        if (settings.users) {
            for (const user of settings.users) {
                const { email, role } = typeof user === 'string' ? { email: user, role: interface_1.MemberRole.Viewer } : user;
                const isProtonUser = await this.account.hasProtonAccount(email);
                if (isProtonUser) {
                    protonUsers.push({ email, role });
                }
                else {
                    nonProtonUsers.push({ email, role });
                }
            }
        }
        // Check if expiration date is in the past before creating share
        // so if this fails, we don't create empty share.
        if (typeof settings.publicLink === 'object' &&
            settings.publicLink.expiration &&
            settings.publicLink.expiration < new Date()) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Expiration date cannot be in the past`);
        }
        let contextShareAddress;
        let currentSharing = await this.getInternalSharingInfo(nodeUid);
        if (!currentSharing) {
            const node = await this.nodesService.getNode(nodeUid);
            try {
                const result = await this.createShare(nodeUid);
                currentSharing = {
                    share: result.share,
                    nodeName: node.name.ok ? node.name.value : node.name.error.name,
                    protonInvitations: [],
                    nonProtonInvitations: [],
                    members: [],
                    publicLink: undefined,
                };
                contextShareAddress = result.contextShareAddress;
            }
            catch (error) {
                // If the share already exists, notify that the node has
                // changed to force refresh and get the latest sharing info
                // again.
                if (error instanceof errors_1.ValidationError && error.code === 2500 /* ErrorCode.ALREADY_EXISTS */) {
                    this.logger.debug(`Share already exists for node ${nodeUid}, refreshing node`);
                    await this.nodesService.notifyNodeChanged(nodeUid);
                    currentSharing = await this.getInternalSharingInfo(nodeUid);
                }
                else {
                    throw error;
                }
            }
        }
        if (!currentSharing) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Failed to get sharing info for node ${nodeUid}`);
        }
        if (!contextShareAddress) {
            contextShareAddress = await this.nodesService.getRootNodeEmailKey(nodeUid);
        }
        const emailOptions = {
            message: settings.emailOptions?.message,
            nodeName: settings.emailOptions?.includeNodeName ? currentSharing.nodeName : undefined,
        };
        for (const user of protonUsers) {
            const { email, role } = user;
            const existingInvitation = currentSharing.protonInvitations.find((invitation) => invitation.inviteeEmail === email);
            if (existingInvitation) {
                if (existingInvitation.role === role) {
                    this.logger.info(`Invitation for ${email} already exists with role ${role} to node ${nodeUid}`);
                    continue;
                }
                this.logger.info(`Invitation for ${email} already exists, updating role to ${role} to node ${nodeUid}`);
                await this.updateInvitation(existingInvitation.uid, role);
                existingInvitation.role = role;
                continue;
            }
            const existingMember = currentSharing.members.find((member) => member.inviteeEmail === email);
            if (existingMember) {
                if (existingMember.role === role) {
                    this.logger.info(`Member ${email} already exists with role ${role} to node ${nodeUid}`);
                    continue;
                }
                this.logger.info(`Member ${email} already exists, updating role to ${role} to node ${nodeUid}`);
                await this.updateMember(existingMember.uid, role);
                existingMember.role = role;
                continue;
            }
            this.logger.info(`Inviting user ${email} with role ${role} to node ${nodeUid}`);
            const invitation = await this.inviteProtonUser(contextShareAddress, currentSharing.share, email, role, emailOptions);
            currentSharing.protonInvitations.push(invitation);
        }
        for (const user of nonProtonUsers) {
            const { email, role } = user;
            const existingExternalInvitation = currentSharing.nonProtonInvitations.find((invitation) => invitation.inviteeEmail === email);
            if (existingExternalInvitation) {
                if (existingExternalInvitation.role === role) {
                    this.logger.info(`External invitation for ${email} already exists with role ${role} to node ${nodeUid}`);
                    continue;
                }
                this.logger.info(`External invitation for ${email} already exists, updating role to ${role} to node ${nodeUid}`);
                await this.updateExternalInvitation(existingExternalInvitation.uid, role);
                existingExternalInvitation.role = role;
                continue;
            }
            const existingMember = currentSharing.members.find((member) => member.inviteeEmail === email);
            if (existingMember) {
                if (existingMember.role === role) {
                    this.logger.info(`Member ${email} already exists with role ${role} to node ${nodeUid}`);
                    continue;
                }
                this.logger.info(`Member ${email} already exists, updating role to ${role} to node ${nodeUid}`);
                await this.updateMember(existingMember.uid, role);
                existingMember.role = role;
                continue;
            }
            this.logger.info(`Inviting external user ${email} with role ${role} to node ${nodeUid}`);
            const invitation = await this.inviteExternalUser(contextShareAddress, currentSharing.share, email, role, emailOptions);
            currentSharing.nonProtonInvitations.push(invitation);
        }
        if (settings.publicLink) {
            const options = settings.publicLink === true ? { role: interface_1.MemberRole.Viewer } : settings.publicLink;
            if (currentSharing.publicLink) {
                this.logger.info(`Updating public link with role ${options.role} to node ${nodeUid}`);
                currentSharing.publicLink = await this.updateSharedLink(currentSharing.share, currentSharing.publicLink, options);
            }
            else {
                this.logger.info(`Sharing via public link with role ${options.role} to node ${nodeUid}`);
                currentSharing.publicLink = await this.shareViaLink(contextShareAddress, currentSharing.share, options);
            }
        }
        return {
            protonInvitations: currentSharing.protonInvitations,
            nonProtonInvitations: currentSharing.nonProtonInvitations,
            members: currentSharing.members,
            publicLink: currentSharing.publicLink,
        };
    }
    async unshareNode(nodeUid, settings) {
        const currentSharing = await this.getInternalSharingInfo(nodeUid);
        if (!currentSharing) {
            return;
        }
        if (!settings) {
            this.logger.info(`Unsharing node ${nodeUid}`);
            await this.deleteShareWithForce(currentSharing.share.shareId, nodeUid);
            return;
        }
        for (const userEmail of settings.users || []) {
            const existingInvitation = currentSharing.protonInvitations.find((invitation) => invitation.inviteeEmail === userEmail);
            if (existingInvitation) {
                this.logger.info(`Deleting invitation for ${userEmail} to node ${nodeUid}`);
                await this.deleteInvitation(existingInvitation.uid);
                currentSharing.protonInvitations = currentSharing.protonInvitations.filter((invitation) => invitation.uid !== existingInvitation.uid);
                continue;
            }
            const existingExternalInvitation = currentSharing.nonProtonInvitations.find((invitation) => invitation.inviteeEmail === userEmail);
            if (existingExternalInvitation) {
                this.logger.info(`Deleting external invitation for ${userEmail} to node ${nodeUid}`);
                await this.deleteExternalInvitation(existingExternalInvitation.uid);
                currentSharing.nonProtonInvitations = currentSharing.nonProtonInvitations.filter((invitation) => invitation.uid !== existingExternalInvitation.uid);
                continue;
            }
            const existingMember = currentSharing.members.find((member) => member.inviteeEmail === userEmail);
            if (existingMember) {
                this.logger.info(`Removing member ${userEmail} to node ${nodeUid}`);
                await this.removeMember(existingMember.uid);
                currentSharing.members = currentSharing.members.filter((member) => member.uid !== existingMember.uid);
                continue;
            }
            this.logger.info(`User ${userEmail} not found in sharing info for node ${nodeUid}`);
        }
        if (settings.publicLink === 'remove') {
            if (currentSharing.publicLink) {
                this.logger.info(`Removing public link to node ${nodeUid}`);
                await this.removeSharedLink(currentSharing.publicLink.uid);
            }
            else {
                this.logger.info(`Public link not found for node ${nodeUid}`);
            }
            currentSharing.publicLink = undefined;
        }
        if (currentSharing.protonInvitations.length === 0 &&
            currentSharing.nonProtonInvitations.length === 0 &&
            currentSharing.members.length === 0 &&
            !currentSharing.publicLink) {
            // Technically it is not needed to delete the share explicitly
            // as it will be deleted when the last member is removed by the
            // backend, but that might take a while and it is better to
            // update local state immediately.
            this.logger.info(`Deleting share ${currentSharing.share.shareId} for node ${nodeUid}`);
            try {
                await this.deleteShareWithForce(currentSharing.share.shareId, nodeUid);
            }
            catch (error) {
                // If deleting the share fails, we don't want to throw an error
                // as it might be a race condition that other client updated
                // the share and it is not empty.
                // If share is truly empty, backend will delete it eventually.
                this.logger.warn(`Failed to delete share ${currentSharing.share.shareId} for node ${nodeUid}: ${(0, errors_2.getErrorMessage)(error)}`);
            }
            return;
        }
        return {
            protonInvitations: currentSharing.protonInvitations,
            nonProtonInvitations: currentSharing.nonProtonInvitations,
            members: currentSharing.members,
            publicLink: currentSharing.publicLink,
        };
    }
    async getInternalSharingInfo(nodeUid) {
        const node = await this.nodesService.getNode(nodeUid);
        if (!node.shareId) {
            return;
        }
        const sharingInfo = await this.getSharingInfo(nodeUid);
        if (!sharingInfo) {
            return;
        }
        const { volumeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const { key: nodeKey } = await this.nodesService.getNodeKeys(nodeUid);
        const encryptedShare = await this.sharesService.loadEncryptedShare(node.shareId);
        const { passphraseSessionKey } = await this.cryptoService.decryptShare(encryptedShare, nodeKey);
        return {
            ...sharingInfo,
            share: {
                volumeId,
                shareId: node.shareId,
                creatorEmail: encryptedShare.creatorEmail,
                passphraseSessionKey: passphraseSessionKey,
            },
            nodeName: node.name.ok ? node.name.value : node.name.error.name,
        };
    }
    async createShare(nodeUid) {
        const node = await this.nodesService.getNode(nodeUid);
        if (!node.parentUid) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Cannot share root folder`);
        }
        const { volumeId } = (0, uids_1.splitNodeUid)(nodeUid);
        const { email, addressId, addressKey } = await this.nodesService.getRootNodeEmailKey(nodeUid);
        const nodeKeys = await this.nodesService.getNodePrivateAndSessionKeys(nodeUid);
        const keys = await this.cryptoService.generateShareKeys(nodeKeys, addressKey);
        const shareId = await this.apiService.createStandardShare(nodeUid, addressId, keys.shareKey.encrypted, {
            base64PassphraseKeyPacket: keys.base64PpassphraseKeyPacket,
            base64NameKeyPacket: keys.base64NameKeyPacket,
        });
        await this.nodesService.notifyNodeChanged(nodeUid);
        if (await this.cache.hasSharedByMeNodeUidsLoaded()) {
            await this.cache.addSharedByMeNodeUid(nodeUid);
        }
        const share = {
            volumeId,
            shareId,
            creatorEmail: email,
            passphraseSessionKey: keys.shareKey.decrypted.passphraseSessionKey,
        };
        const contextShareAddress = {
            email,
            addressId,
            addressKey,
        };
        return {
            share,
            contextShareAddress,
        };
    }
    /**
     * Deletes the share even if it is not empty.
     */
    async deleteShareWithForce(shareId, nodeUid) {
        await this.apiService.deleteShare(shareId, true);
        await this.nodesService.notifyNodeChanged(nodeUid);
        if (await this.cache.hasSharedByMeNodeUidsLoaded()) {
            await this.cache.removeSharedByMeNodeUid(nodeUid);
        }
    }
    async inviteProtonUser(inviter, share, inviteeEmail, role, emailOptions) {
        const invitationCrypto = await this.cryptoService.encryptInvitation(share.passphraseSessionKey, inviter.addressKey, inviteeEmail);
        const encryptedInvitation = await this.apiService.inviteProtonUser(share.shareId, {
            addedByEmail: inviter.email,
            inviteeEmail: inviteeEmail,
            role,
            ...invitationCrypto,
        }, emailOptions);
        return {
            ...encryptedInvitation,
            addedByEmail: (0, interface_1.resultOk)(encryptedInvitation.addedByEmail),
        };
    }
    async updateInvitation(invitationUid, role) {
        await this.apiService.updateInvitation(invitationUid, { role });
    }
    async resendInvitationEmail(nodeUid, invitationUid) {
        const currentSharing = await this.getInternalSharingInfo(nodeUid);
        if (!currentSharing) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Node is not shared`);
        }
        const protonInvite = currentSharing.protonInvitations.find((invitation) => invitation.uid === invitationUid);
        if (protonInvite) {
            return await this.apiService.resendInvitationEmail(protonInvite.uid);
        }
        const nonProtonInvite = currentSharing.nonProtonInvitations.find((invitation) => invitation.uid === invitationUid);
        if (nonProtonInvite) {
            return await this.apiService.resendExternalInvitationEmail(nonProtonInvite.uid);
        }
        throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Invitation not found`);
    }
    async deleteInvitation(invitationUid) {
        await this.apiService.deleteInvitation(invitationUid);
    }
    async inviteExternalUser(inviter, share, inviteeEmail, role, emailOptions) {
        const invitationCrypto = await this.cryptoService.encryptExternalInvitation(share.passphraseSessionKey, inviter.addressKey, inviteeEmail);
        const encryptedInvitation = await this.apiService.inviteExternalUser(share.shareId, {
            inviterAddressId: inviter.addressId,
            inviteeEmail: inviteeEmail,
            role,
            base64Signature: invitationCrypto.base64ExternalInvitationSignature,
        }, emailOptions);
        return {
            uid: encryptedInvitation.uid,
            invitationTime: encryptedInvitation.invitationTime,
            addedByEmail: (0, interface_1.resultOk)(inviter.email),
            inviteeEmail,
            role,
            state: encryptedInvitation.state,
        };
    }
    async updateExternalInvitation(invitationUid, role) {
        await this.apiService.updateExternalInvitation(invitationUid, { role });
    }
    async deleteExternalInvitation(invitationUid) {
        await this.apiService.deleteExternalInvitation(invitationUid);
    }
    async convertExternalInvitationsToInternal() {
        // FIXME
    }
    async removeMember(memberUid) {
        await this.apiService.removeMember(memberUid);
    }
    async updateMember(memberUid, role) {
        await this.apiService.updateMember(memberUid, { role });
    }
    async shareViaLink(inviter, share, options) {
        const generatedPassword = await this.cryptoService.generatePublicLinkPassword();
        const password = options.customPassword ? `${generatedPassword}${options.customPassword}` : generatedPassword;
        const { crypto, srp } = await this.cryptoService.encryptPublicLink(inviter.email, share.passphraseSessionKey, password);
        const publicLink = await this.apiService.createPublicLink(share.shareId, {
            creatorEmail: inviter.email,
            role: options.role,
            includesCustomPassword: !!options.customPassword,
            expirationTime: options.expiration ? Math.floor(options.expiration.getTime() / 1000) : undefined,
            crypto,
            srp,
        });
        return {
            uid: publicLink.uid,
            creationTime: new Date(),
            role: options.role,
            url: `${publicLink.publicUrl}#${generatedPassword}`,
            customPassword: options.customPassword,
            expirationTime: options.expiration,
            numberOfInitializedDownloads: 0,
            creatorEmail: inviter.email,
        };
    }
    async updateSharedLink(share, publicLink, options) {
        const generatedPassword = publicLink.url.split('#')[1];
        // Legacy public links didn't have generated password or had various lengths.
        if (!generatedPassword || generatedPassword.length !== cryptoService_1.PUBLIC_LINK_GENERATED_PASSWORD_LENGTH) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Legacy public link cannot be updated. Please re-create a new public link.`);
        }
        const password = options.customPassword ? `${generatedPassword}${options.customPassword}` : generatedPassword;
        const { crypto, srp } = await this.cryptoService.encryptPublicLink(publicLink.creatorEmail, share.passphraseSessionKey, password);
        await this.apiService.updatePublicLink(publicLink.uid, {
            role: options.role,
            includesCustomPassword: !!options.customPassword,
            expirationTime: options.expiration ? Math.floor(options.expiration.getTime() / 1000) : undefined,
            crypto,
            srp,
        });
        return {
            ...publicLink,
            role: options.role,
            customPassword: options.customPassword,
            expirationTime: options.expiration,
        };
    }
    async removeSharedLink(publicLinkUid) {
        await this.apiService.removePublicLink(publicLinkUid);
    }
}
exports.SharingManagement = SharingManagement;
//# sourceMappingURL=sharingManagement.js.map