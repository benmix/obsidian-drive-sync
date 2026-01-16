"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockVerifier = void 0;
class BlockVerifier {
    apiService;
    cryptoService;
    nodeKey;
    draftNodeRevisionUid;
    verificationCode;
    contentKeyPacketSessionKey;
    constructor(apiService, cryptoService, nodeKey, draftNodeRevisionUid) {
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.nodeKey = nodeKey;
        this.draftNodeRevisionUid = draftNodeRevisionUid;
        this.apiService = apiService;
        this.cryptoService = cryptoService;
        this.draftNodeRevisionUid = draftNodeRevisionUid;
    }
    async loadVerificationData() {
        const result = await this.apiService.getVerificationData(this.draftNodeRevisionUid);
        this.verificationCode = result.verificationCode;
        this.contentKeyPacketSessionKey = await this.cryptoService.getContentKeyPacketSessionKey(this.nodeKey, result.base64ContentKeyPacket);
    }
    async verifyBlock(encryptedBlock) {
        if (!this.verificationCode || !this.contentKeyPacketSessionKey) {
            throw new Error('Verifying block before loading verification data');
        }
        return this.cryptoService.verifyBlock(this.contentKeyPacketSessionKey, this.verificationCode, encryptedBlock);
    }
}
exports.BlockVerifier = BlockVerifier;
//# sourceMappingURL=blockVerifier.js.map