"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingPublicSessionAPIService = void 0;
const apiService_1 = require("../../apiService");
const uids_1 = require("../../uids");
/**
 * Provides API communication for managing public link session (not data).
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
class SharingPublicSessionAPIService {
    logger;
    apiService;
    constructor(logger, apiService) {
        this.logger = logger;
        this.apiService = apiService;
        this.logger = logger;
        this.apiService = apiService;
    }
    /**
     * Start a SRP handshake for public link session.
     */
    async initPublicLinkSession(token) {
        const response = await this.apiService.get(`drive/urls/${token}/info`);
        return {
            srp: {
                version: response.Version,
                modulus: response.Modulus,
                serverEphemeral: response.ServerEphemeral,
                salt: response.UrlPasswordSalt,
                srpSession: response.SRPSession,
            },
            isCustomPasswordProtected: (response.Flags & 1) === 1,
            isLegacy: response.Flags === 0 || response.Flags === 1,
            vendorType: response.VendorType,
            directAccess: response.DirectAccess
                ? {
                    nodeUid: (0, uids_1.makeNodeUid)(response.DirectAccess.VolumeID, response.DirectAccess.LinkID),
                    directRole: (0, apiService_1.permissionsToMemberRole)(this.logger, response.DirectAccess.DirectPermissions),
                    publicRole: (0, apiService_1.permissionsToMemberRole)(this.logger, response.DirectAccess.PublicPermissions),
                }
                : undefined,
        };
    }
    /**
     * Authenticate a public link session.
     *
     * It returns the server proof that must be validated, and the session uid
     * with an optional access token. The access token is only returned if
     * the session is newly created.
     */
    async authPublicLinkSession(token, srp) {
        const response = await this.apiService.post(`drive/urls/${token}/auth`, {
            ClientProof: srp.clientProof,
            ClientEphemeral: srp.clientEphemeral,
            SRPSession: srp.srpSession,
        });
        return {
            session: {
                serverProof: response.ServerProof,
                sessionUid: response.UID,
                sessionAccessToken: response.AccessToken,
            },
            encryptedShare: {
                base64UrlPasswordSalt: response.Share.SharePasswordSalt,
                armoredKey: response.Share.ShareKey,
                armoredPassphrase: response.Share.SharePassphrase,
                publicPermissions: response.Share.PublicPermissions,
            },
            rootUid: (0, uids_1.makeNodeUid)(response.Share.VolumeID, response.Share.LinkID),
        };
    }
}
exports.SharingPublicSessionAPIService = SharingPublicSessionAPIService;
//# sourceMappingURL=apiService.js.map