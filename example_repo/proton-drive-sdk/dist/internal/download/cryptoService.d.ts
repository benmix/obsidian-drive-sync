import { DriveCrypto, PrivateKey, SessionKey } from '../../crypto';
import { ProtonDriveAccount, Revision } from '../../interface';
import { RevisionKeys } from './interface';
export declare class DownloadCryptoService {
    private driveCrypto;
    private account;
    constructor(driveCrypto: DriveCrypto, account: ProtonDriveAccount);
    getRevisionKeys(nodeKey: {
        key: PrivateKey;
        contentKeyPacketSessionKey: SessionKey;
    }, revision: Revision): Promise<RevisionKeys>;
    decryptBlock(encryptedBlock: Uint8Array, revisionKeys: RevisionKeys): Promise<Uint8Array>;
    decryptThumbnail(thumbnail: Uint8Array, contentKeyPacketSessionKey: SessionKey): Promise<Uint8Array>;
    verifyBlockIntegrity(encryptedBlock: Uint8Array, base64sha256Hash: string): Promise<void>;
    verifyManifest(revision: Revision, nodeKey: PrivateKey, allBlockHashes: Uint8Array[], armoredManifestSignature?: string): Promise<void>;
    private getRevisionVerificationKeys;
}
