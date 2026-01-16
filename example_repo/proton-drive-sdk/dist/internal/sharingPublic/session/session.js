"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingPublicLinkSession = void 0;
/**
 * Session for a public link.
 *
 * It is responsible for initializing and authenticating the public link session
 * with the SRP handshake. It also can re-authenticate the session if it is expired.
 */
class SharingPublicLinkSession {
    apiService;
    srpModule;
    token;
    password;
    sessionUid;
    sessionAccessToken;
    constructor(apiService, srpModule, token, password) {
        this.apiService = apiService;
        this.srpModule = srpModule;
        this.token = token;
        this.password = password;
        this.apiService = apiService;
        this.srpModule = srpModule;
        this.token = token;
        this.password = password;
    }
    async reauth() {
        const info = await this.init();
        await this.auth(info.srp);
    }
    async init() {
        return this.apiService.initPublicLinkSession(this.token);
    }
    async auth(srp) {
        const { expectedServerProof, clientProof, clientEphemeral } = await this.srpModule.getSrp(srp.version, srp.modulus, srp.serverEphemeral, srp.salt, this.password);
        const auth = await this.apiService.authPublicLinkSession(this.token, {
            clientProof,
            clientEphemeral,
            srpSession: srp.srpSession,
        });
        if (auth.session.serverProof !== expectedServerProof) {
            throw new Error('Invalid server proof');
        }
        this.sessionUid = auth.session.sessionUid;
        this.sessionAccessToken = auth.session.sessionAccessToken;
        return {
            encryptedShare: auth.encryptedShare,
            rootUid: auth.rootUid,
        };
    }
    /**
     * Get the session uid and access token.
     *
     * The access token is only returned if the session is newly created.
     * If the access token is not available, it means the existing session
     * can be used to access the public link.
     *
     * @throws If the session is not initialized.
     */
    get session() {
        if (!this.sessionUid) {
            throw new Error('Session not initialized');
        }
        return {
            uid: this.sessionUid,
            accessToken: this.sessionAccessToken,
        };
    }
}
exports.SharingPublicLinkSession = SharingPublicLinkSession;
//# sourceMappingURL=session.js.map