import { AnonymousUser } from '../../interface';
import { DriveAPIService } from '../apiService';
import { UploadTokens } from './interface';
import { ThumbnailType } from '../../interface';
export declare class UploadAPIService {
    protected apiService: DriveAPIService;
    protected clientUid: string | undefined;
    constructor(apiService: DriveAPIService, clientUid: string | undefined);
    createDraft(parentNodeUid: string, node: {
        armoredEncryptedName: string;
        hash: string;
        mediaType: string;
        intendedUploadSize?: number;
        armoredNodeKey: string;
        armoredNodePassphrase: string;
        armoredNodePassphraseSignature: string;
        base64ContentKeyPacket: string;
        armoredContentKeyPacketSignature: string;
        signatureEmail: string | AnonymousUser;
    }): Promise<{
        nodeUid: string;
        nodeRevisionUid: string;
    }>;
    createDraftRevision(nodeUid: string, revision: {
        currentRevisionUid: string;
        intendedUploadSize?: number;
    }): Promise<{
        nodeRevisionUid: string;
    }>;
    getVerificationData(draftNodeRevisionUid: string): Promise<{
        verificationCode: Uint8Array;
        base64ContentKeyPacket: string;
    }>;
    requestBlockUpload(draftNodeRevisionUid: string, addressId: string | AnonymousUser, blocks: {
        contentBlocks: {
            index: number;
            hash: Uint8Array;
            encryptedSize: number;
            armoredSignature: string;
            verificationToken: Uint8Array;
        }[];
        thumbnails?: {
            type: ThumbnailType;
            hash: Uint8Array;
            encryptedSize: number;
        }[];
    }): Promise<UploadTokens>;
    commitDraftRevision(draftNodeRevisionUid: string, options: {
        armoredManifestSignature: string;
        signatureEmail: string | AnonymousUser;
        armoredExtendedAttributes?: string;
    }): Promise<void>;
    deleteDraft(draftNodeUid: string): Promise<void>;
    deleteDraftRevision(draftNodeRevisionUid: string): Promise<void>;
    uploadBlock(url: string, token: string, block: Uint8Array, onProgress?: (uploadedBytes: number) => void, signal?: AbortSignal): Promise<void>;
    isRevisionUploaded(nodeRevisionUid: string): Promise<boolean>;
}
