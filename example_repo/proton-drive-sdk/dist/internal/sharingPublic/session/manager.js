"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingPublicSessionManager = void 0;
const apiService_1 = require("../../apiService");
const apiService_2 = require("./apiService");
const httpClient_1 = require("./httpClient");
const session_1 = require("./session");
const url_1 = require("./url");
/**
 * Manages sessions for public links.
 *
 * It can be used to get access to multiple public links.
 */
class SharingPublicSessionManager {
    httpClient;
    driveCrypto;
    srpModule;
    api;
    infosPerToken = new Map();
    logger;
    constructor(telemetry, httpClient, driveCrypto, srpModule, apiService) {
        this.httpClient = httpClient;
        this.driveCrypto = driveCrypto;
        this.srpModule = srpModule;
        this.logger = telemetry.getLogger('sharingPublicSession');
        this.httpClient = httpClient;
        this.driveCrypto = driveCrypto;
        this.srpModule = srpModule;
        this.api = new apiService_2.SharingPublicSessionAPIService(telemetry.getLogger('sharingPublicSession'), apiService);
    }
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
    async getInfo(url) {
        const { token } = (0, url_1.getTokenAndPasswordFromUrl)(url);
        const info = await this.api.initPublicLinkSession(token);
        this.infosPerToken.set(token, info);
        return {
            isCustomPasswordProtected: info.isCustomPasswordProtected,
            isLegacy: info.isLegacy,
            vendorType: info.vendorType,
            directAccess: info.directAccess,
        };
    }
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
    async auth(url, customPassword) {
        const { token, password: urlPassword } = (0, url_1.getTokenAndPasswordFromUrl)(url);
        let info = this.infosPerToken.get(token);
        if (!info) {
            info = await this.api.initPublicLinkSession(token);
        }
        const password = `${urlPassword}${customPassword || ''}`;
        const session = new session_1.SharingPublicLinkSession(this.api, this.srpModule, token, password);
        const { encryptedShare, rootUid } = await session.auth(info.srp);
        const shareKey = await this.decryptShareKey(encryptedShare, password);
        return {
            token,
            httpClient: new httpClient_1.SharingPublicSessionHttpClient(this.httpClient, session),
            shareKey,
            rootUid,
            publicRole: (0, apiService_1.permissionsToMemberRole)(this.logger, encryptedShare.publicPermissions),
        };
    }
    async decryptShareKey(encryptedShare, password) {
        const { key: shareKey } = await this.driveCrypto.decryptKeyWithSrpPassword(password, encryptedShare.base64UrlPasswordSalt, encryptedShare.armoredKey, encryptedShare.armoredPassphrase);
        return shareKey;
    }
}
exports.SharingPublicSessionManager = SharingPublicSessionManager;
//# sourceMappingURL=manager.js.map