"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharesAPIService = void 0;
const uids_1 = require("../uids");
const interface_1 = require("./interface");
/**
 * Provides API communication for fetching shares and creating volumes.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
class SharesAPIService {
    apiService;
    constructor(apiService) {
        this.apiService = apiService;
        this.apiService = apiService;
    }
    async getMyFiles() {
        const response = await this.apiService.get('drive/v2/shares/my-files');
        return {
            volumeId: response.Volume.VolumeID,
            shareId: response.Share.ShareID,
            rootNodeId: response.Link.Link.LinkID,
            creatorEmail: response.Share.CreatorEmail,
            encryptedCrypto: {
                armoredKey: response.Share.Key,
                armoredPassphrase: response.Share.Passphrase,
                armoredPassphraseSignature: response.Share.PassphraseSignature,
            },
            addressId: response.Share.AddressID,
            type: interface_1.ShareType.Main,
        };
    }
    async getVolume(volumeId) {
        const response = await this.apiService.get(`drive/volumes/${volumeId}`);
        return {
            shareId: response.Volume.Share.ShareID,
        };
    }
    async getShare(shareId) {
        const response = await this.apiService.get(`drive/shares/${shareId}`);
        return convertSharePayload(response);
    }
    /**
     * Returns root share with address key.
     *
     * This function provides access to root shares that provides access
     * to node tree via address key. For this reason, caller must use this
     * only when it is clear the shareId is root share.
     *
     * @throws Error when share is not root share.
     */
    async getRootShare(shareId) {
        const response = await this.apiService.get(`drive/shares/${shareId}`);
        if (!response.AddressID) {
            throw new Error('Loading share without direct access is not supported');
        }
        return {
            ...convertSharePayload(response),
            addressId: response.AddressID,
        };
    }
    async createVolume(share, node) {
        const response = await this.apiService.post('drive/volumes', {
            AddressID: share.addressId,
            AddressKeyID: share.addressKeyId,
            ShareKey: share.armoredKey,
            SharePassphrase: share.armoredPassphrase,
            SharePassphraseSignature: share.armoredPassphraseSignature,
            FolderName: node.encryptedName,
            FolderKey: node.armoredKey,
            FolderPassphrase: node.armoredPassphrase,
            FolderPassphraseSignature: node.armoredPassphraseSignature,
            FolderHashKey: node.armoredHashKey,
        });
        return {
            volumeId: response.Volume.ID,
            shareId: response.Volume.Share.ShareID,
            rootNodeId: response.Volume.Share.LinkID,
        };
    }
    async createShare(volumeId, share, node) {
        const response = await this.apiService.post(`/drive/volumes/${volumeId}/shares`, {
            AddressID: share.addressId,
            ShareKey: share.armoredKey,
            SharePassphrase: share.armoredPassphrase,
            SharePassphraseSignature: share.armoredPassphraseSignature,
            RootLinkID: node.nodeId,
            NameKeyPacket: node.nameKeyPacket,
            PassphraseKeyPacket: node.passphraseKeyPacket,
        });
        return {
            shareId: response.Share.ID,
        };
    }
}
exports.SharesAPIService = SharesAPIService;
function convertSharePayload(response) {
    return {
        volumeId: response.VolumeID,
        shareId: response.ShareID,
        rootNodeId: response.LinkID,
        creatorEmail: response.Creator,
        creationTime: response.CreateTime ? new Date(response.CreateTime * 1000) : undefined,
        encryptedCrypto: {
            armoredKey: response.Key,
            armoredPassphrase: response.Passphrase,
            armoredPassphraseSignature: response.PassphraseSignature,
        },
        membership: response.Memberships?.[0]
            ? {
                memberUid: (0, uids_1.makeMemberUid)(response.ShareID, response.Memberships[0].MemberID),
            }
            : undefined,
        type: convertShareTypeNumberToEnum(response.Type),
    };
}
function convertShareTypeNumberToEnum(type) {
    switch (type) {
        case 1:
            return interface_1.ShareType.Main;
        case 2:
            return interface_1.ShareType.Standard;
        case 3:
            return interface_1.ShareType.Device;
        case 4:
            return interface_1.ShareType.Photo;
        case 5:
            throw new Error('Organization shares are not supported yet');
    }
}
//# sourceMappingURL=apiService.js.map