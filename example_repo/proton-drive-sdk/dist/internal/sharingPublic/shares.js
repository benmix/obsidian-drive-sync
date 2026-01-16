"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingPublicSharesManager = void 0;
const interface_1 = require("../../interface");
const uids_1 = require("../uids");
/**
 * Provides high-level actions for managing public link share.
 *
 * The public link share manager provides the same interface as the code share
 * service so it can be used in the same way in various modules that use shares.
 */
class SharingPublicSharesManager {
    account;
    publicShareKey;
    publicRootNodeUid;
    constructor(account, publicShareKey, publicRootNodeUid) {
        this.account = account;
        this.publicShareKey = publicShareKey;
        this.publicRootNodeUid = publicRootNodeUid;
        this.account = account;
        this.publicShareKey = publicShareKey;
        this.publicRootNodeUid = publicRootNodeUid;
    }
    async getRootIDs() {
        const { volumeId, nodeId: rootNodeId } = (0, uids_1.splitNodeUid)(this.publicRootNodeUid);
        return { volumeId, rootNodeId, rootNodeUid: this.publicRootNodeUid };
    }
    async getSharePrivateKey() {
        return this.publicShareKey;
    }
    async getContextShareMemberEmailKey() {
        const address = await this.account.getOwnPrimaryAddress();
        return {
            email: address.email,
            addressId: address.addressId,
            addressKey: address.keys[address.primaryKeyIndex].key,
            addressKeyId: address.keys[address.primaryKeyIndex].id,
        };
    }
    async getVolumeMetricContext() {
        return interface_1.MetricVolumeType.SharedPublic;
    }
}
exports.SharingPublicSharesManager = SharingPublicSharesManager;
//# sourceMappingURL=shares.js.map