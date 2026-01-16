import { MemberRole, ProtonDriveHTTPClient, ProtonDriveTelemetry } from '../../../interface';
import { DriveCrypto, PrivateKey, SRPModule } from '../../../crypto';
import { DriveAPIService } from '../../apiService';
import { SharingPublicSessionHttpClient } from './httpClient';
/**
 * Manages sessions for public links.
 *
 * It can be used to get access to multiple public links.
 */
export declare class SharingPublicSessionManager {
    private httpClient;
    private driveCrypto;
    private srpModule;
    private api;
    private infosPerToken;
    private logger;
    constructor(telemetry: ProtonDriveTelemetry, httpClient: ProtonDriveHTTPClient, driveCrypto: DriveCrypto, srpModule: SRPModule, apiService: DriveAPIService);
    /**
     * Get the info for a public link.
     *
     * It returns the info for the public link, including if it is custom
     * password protected, if it is legacy (not supported anymore), and
     * the vendor type (whether it is Proton Docs, for example, and should
     * be redirected to the public Docs app).
     *
     * @param url - The URL of the public link.
     */
    getInfo(url: string): Promise<{
        isCustomPasswordProtected: boolean;
        isLegacy: boolean;
        vendorType: number;
        directAccess?: {
            nodeUid: string;
            directRole: MemberRole;
            publicRole: MemberRole;
        };
    }>;
    /**
     * Authenticate a public link session.
     *
     * It returns HTTP client that must be used for the endpoints to access the
     * public link data.
     *
     * It returnes parsed token and full password (password from the URL +
     * custom password) that can be used for decrypting the share key.
     *
     * @param url - The URL of the public link.
     * @param customPassword - The custom password for the public link, if it is
     * custom password protected.
     */
    auth(url: string, customPassword?: string): Promise<{
        token: string;
        httpClient: SharingPublicSessionHttpClient;
        shareKey: PrivateKey;
        rootUid: string;
        publicRole: MemberRole;
    }>;
    private decryptShareKey;
}
