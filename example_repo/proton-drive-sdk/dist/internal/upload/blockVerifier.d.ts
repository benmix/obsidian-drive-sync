import { PrivateKey } from '../../crypto';
import { UploadAPIService } from './apiService';
import { UploadCryptoService } from './cryptoService';
export declare class BlockVerifier {
    private apiService;
    private cryptoService;
    private nodeKey;
    private draftNodeRevisionUid;
    private verificationCode?;
    private contentKeyPacketSessionKey?;
    constructor(apiService: UploadAPIService, cryptoService: UploadCryptoService, nodeKey: PrivateKey, draftNodeRevisionUid: string);
    loadVerificationData(): Promise<void>;
    verifyBlock(encryptedBlock: Uint8Array): Promise<{
        verificationToken: Uint8Array;
    }>;
}
