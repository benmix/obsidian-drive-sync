import { Logger } from '../../../interface';
import { DriveAPIService } from '../../apiService';
import { PublicLinkInfo, PublicLinkSrpAuth, PublicLinkSession, EncryptedShareCrypto } from './interface';
/**
 * Provides API communication for managing public link session (not data).
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
export declare class SharingPublicSessionAPIService {
    private logger;
    private apiService;
    constructor(logger: Logger, apiService: DriveAPIService);
    /**
     * Start a SRP handshake for public link session.
     */
    initPublicLinkSession(token: string): Promise<PublicLinkInfo>;
    /**
     * Authenticate a public link session.
     *
     * It returns the server proof that must be validated, and the session uid
     * with an optional access token. The access token is only returned if
     * the session is newly created.
     */
    authPublicLinkSession(token: string, srp: PublicLinkSrpAuth): Promise<{
        session: PublicLinkSession;
        encryptedShare: EncryptedShareCrypto;
        rootUid: string;
    }>;
}
