import { DriveCrypto, PrivateKey, SessionKey } from '../../crypto';
import { Thumbnail, AnonymousUser } from '../../interface';
import { EncryptedBlock, EncryptedThumbnail, NodeCrypto, NodeCryptoSigningKeys, NodeRevisionDraftKeys, NodesService } from './interface';
export declare class UploadCryptoService {
    protected driveCrypto: DriveCrypto;
    protected nodesService: NodesService;
    constructor(driveCrypto: DriveCrypto, nodesService: NodesService);
    generateFileCrypto(parentUid: string, parentKeys: {
        key: PrivateKey;
        hashKey: Uint8Array;
    }, name: string): Promise<NodeCrypto>;
    getSigningKeysForExistingNode(uids: {
        nodeUid: string;
        parentNodeUid?: string;
    }): Promise<NodeCryptoSigningKeys>;
    private getSigningKeys;
    encryptThumbnail(nodeRevisionDraftKeys: NodeRevisionDraftKeys, thumbnail: Thumbnail): Promise<EncryptedThumbnail>;
    encryptBlock(verifyBlock: (encryptedBlock: Uint8Array) => Promise<{
        verificationToken: Uint8Array;
    }>, nodeRevisionDraftKeys: NodeRevisionDraftKeys, block: Uint8Array, index: number): Promise<EncryptedBlock>;
    commitFile(nodeRevisionDraftKeys: NodeRevisionDraftKeys, manifest: Uint8Array, extendedAttributes?: string): Promise<{
        armoredManifestSignature: string;
        signatureEmail: string | AnonymousUser;
        armoredExtendedAttributes?: string;
    }>;
    getContentKeyPacketSessionKey(nodeKey: PrivateKey, base64ContentKeyPacket: string): Promise<SessionKey>;
    verifyBlock(contentKeyPacketSessionKey: SessionKey, verificationCode: Uint8Array, encryptedData: Uint8Array): Promise<{
        verificationToken: Uint8Array;
    }>;
}
