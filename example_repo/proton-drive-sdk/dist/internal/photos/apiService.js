"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotosAPIService = void 0;
const interface_1 = require("../shares/interface");
const uids_1 = require("../uids");
/**
 * Provides API communication for fetching and manipulating photos and albums
 * metadata.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
class PhotosAPIService {
    apiService;
    constructor(apiService) {
        this.apiService = apiService;
        this.apiService = apiService;
    }
    async getPhotoShare() {
        const response = await this.apiService.get('drive/v2/shares/photos');
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
            type: interface_1.ShareType.Photo,
        };
    }
    async createPhotoVolume(share, node) {
        const response = await this.apiService.post('drive/photos/volumes', {
            Share: {
                AddressID: share.addressId,
                AddressKeyID: share.addressKeyId,
                Key: share.armoredKey,
                Passphrase: share.armoredPassphrase,
                PassphraseSignature: share.armoredPassphraseSignature,
            },
            Link: {
                Name: node.encryptedName,
                NodeKey: node.armoredKey,
                NodePassphrase: node.armoredPassphrase,
                NodePassphraseSignature: node.armoredPassphraseSignature,
                NodeHashKey: node.armoredHashKey,
            },
        });
        return {
            volumeId: response.Volume.VolumeID,
            shareId: response.Volume.Share.ShareID,
            rootNodeId: response.Volume.Share.LinkID,
        };
    }
    async *iterateTimeline(volumeId, signal) {
        let anchor = '';
        while (true) {
            const response = await this.apiService.get(`drive/volumes/${volumeId}/photos?${anchor ? `PreviousPageLastLinkID=${anchor}` : ''}`, signal);
            for (const photo of response.Photos) {
                const nodeUid = (0, uids_1.makeNodeUid)(volumeId, photo.LinkID);
                yield {
                    nodeUid,
                    captureTime: new Date(photo.CaptureTime * 1000),
                    tags: photo.Tags,
                };
            }
            if (!response.Photos.length) {
                break;
            }
            anchor = response.Photos[response.Photos.length - 1].LinkID;
        }
    }
    async *iterateAlbums(volumeId, signal) {
        let anchor = '';
        while (true) {
            const response = await this.apiService.get(`drive/photos/volumes/${volumeId}/albums?${anchor ? `AnchorID=${anchor}` : ''}`, signal);
            for (const album of response.Albums) {
                const albumUid = (0, uids_1.makeNodeUid)(volumeId, album.LinkID);
                yield {
                    albumUid,
                    coverNodeUid: album.CoverLinkID ? (0, uids_1.makeNodeUid)(volumeId, album.CoverLinkID) : undefined,
                    photoCount: album.PhotoCount,
                    lastActivityTime: new Date(album.LastActivityTime * 1000),
                };
            }
            if (!response.More || !response.AnchorID) {
                break;
            }
            anchor = response.AnchorID;
        }
    }
    async checkPhotoDuplicates(volumeId, nameHashes, signal) {
        const response = await this.apiService.post(`drive/volumes/${volumeId}/photos/duplicates`, {
            NameHashes: nameHashes,
        }, signal);
        return response.DuplicateHashes.map((duplicate) => {
            if (!duplicate.Hash || !duplicate.ContentHash || duplicate.LinkState !== 1 /* Active */) {
                return undefined;
            }
            return {
                nameHash: duplicate.Hash,
                contentHash: duplicate.ContentHash,
                nodeUid: (0, uids_1.makeNodeUid)(volumeId, duplicate.LinkID),
                clientUid: duplicate.ClientUID || undefined,
            };
        }).filter((duplicate) => duplicate !== undefined);
    }
}
exports.PhotosAPIService = PhotosAPIService;
//# sourceMappingURL=apiService.js.map