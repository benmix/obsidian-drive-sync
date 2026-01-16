"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoSharesManager = void 0;
const interface_1 = require("../../interface");
const apiService_1 = require("../apiService");
/**
 * Provides high-level actions for managing photo share.
 *
 * The photo share manager wraps the core share service, but uses photos volume
 * instead of main volume. It provides the same interface so it can be used in
 * the same way in various modules that use shares.
 */
class PhotoSharesManager {
    logger;
    apiService;
    cache;
    cryptoCache;
    cryptoService;
    sharesService;
    photoRootIds;
    constructor(logger, apiService, cache, cryptoCache, cryptoService, sharesService) {
        this.logger = logger;
        this.apiService = apiService;
        this.cache = cache;
        this.cryptoCache = cryptoCache;
        this.cryptoService = cryptoService;
        this.sharesService = sharesService;
        this.logger = logger;
        this.apiService = apiService;
        this.cache = cache;
        this.cryptoCache = cryptoCache;
        this.cryptoService = cryptoService;
        this.sharesService = sharesService;
    }
    async getRootIDs() {
        if (this.photoRootIds) {
            return this.photoRootIds;
        }
        try {
            const encryptedShare = await this.apiService.getPhotoShare();
            // Once any place needs IDs for My files, it will most likely
            // need also the keys for decrypting the tree. It is better to
            // decrypt the share here right away.
            const { share: myFilesShare, key } = await this.cryptoService.decryptRootShare(encryptedShare);
            await this.cryptoCache.setShareKey(myFilesShare.shareId, key);
            await this.cache.setVolume({
                volumeId: myFilesShare.volumeId,
                shareId: myFilesShare.shareId,
                rootNodeId: myFilesShare.rootNodeId,
                creatorEmail: encryptedShare.creatorEmail,
                addressId: encryptedShare.addressId,
            });
            this.photoRootIds = {
                volumeId: myFilesShare.volumeId,
                shareId: myFilesShare.shareId,
                rootNodeId: myFilesShare.rootNodeId,
            };
            return this.photoRootIds;
        }
        catch (error) {
            if (error instanceof apiService_1.NotFoundAPIError) {
                this.logger.warn('Active photo volume not found, creating a new one');
                return this.createVolume();
            }
            this.logger.error('Failed to get active photo volume', error);
            throw error;
        }
    }
    async createVolume() {
        const address = await this.sharesService.getMyFilesShareMemberEmailKey();
        const bootstrap = await this.cryptoService.generateVolumeBootstrap(address.addressKey);
        const photoRootIds = await this.apiService.createPhotoVolume({
            addressId: address.addressId,
            addressKeyId: address.addressKeyId,
            ...bootstrap.shareKey.encrypted,
        }, {
            ...bootstrap.rootNode.key.encrypted,
            encryptedName: bootstrap.rootNode.encryptedName,
            armoredHashKey: bootstrap.rootNode.armoredHashKey,
        });
        await this.cryptoCache.setShareKey(photoRootIds.shareId, bootstrap.shareKey.decrypted);
        return photoRootIds;
    }
    async getSharePrivateKey(shareId) {
        return this.sharesService.getSharePrivateKey(shareId);
    }
    async getMyFilesShareMemberEmailKey() {
        return this.sharesService.getMyFilesShareMemberEmailKey();
    }
    async getContextShareMemberEmailKey(shareId) {
        return this.sharesService.getContextShareMemberEmailKey(shareId);
    }
    async isOwnVolume(volumeId) {
        const { volumeId: myVolumeId } = await this.getRootIDs();
        if (volumeId === myVolumeId) {
            return true;
        }
        return this.sharesService.isOwnVolume(volumeId);
    }
    async getVolumeMetricContext(volumeId) {
        const { volumeId: myVolumeId } = await this.getRootIDs();
        if (volumeId === myVolumeId) {
            return interface_1.MetricVolumeType.OwnVolume;
        }
        return this.sharesService.getVolumeMetricContext(volumeId);
    }
    async loadEncryptedShare(shareId) {
        return this.sharesService.loadEncryptedShare(shareId);
    }
}
exports.PhotoSharesManager = PhotoSharesManager;
//# sourceMappingURL=shares.js.map