import { SRPModule } from '../../../crypto';
import { SharingPublicSessionAPIService } from './apiService';
import { EncryptedShareCrypto, PublicLinkInfo, PublicLinkSrpInfo } from './interface';
/**
 * Session for a public link.
 *
 * It is responsible for initializing and authenticating the public link session
 * with the SRP handshake. It also can re-authenticate the session if it is expired.
 */
export declare class SharingPublicLinkSession {
    private apiService;
    private srpModule;
    private token;
    private password;
    private sessionUid?;
    private sessionAccessToken?;
    constructor(apiService: SharingPublicSessionAPIService, srpModule: SRPModule, token: string, password: string);
    reauth(): Promise<void>;
    init(): Promise<PublicLinkInfo>;
    auth(srp: PublicLinkSrpInfo): Promise<{
        encryptedShare: EncryptedShareCrypto;
        rootUid: string;
    }>;
    /**
     * Get the session uid and access token.
     *
     * The access token is only returned if the session is newly created.
     * If the access token is not available, it means the existing session
     * can be used to access the public link.
     *
     * @throws If the session is not initialized.
     */
    get session(): {
        uid: string;
        accessToken: string | undefined;
    };
}
