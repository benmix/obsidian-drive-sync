"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
function getConfig(config) {
    return {
        baseUrl: config?.baseUrl ? `https://${config.baseUrl}` : 'https://drive-api.proton.me',
        language: config?.language || 'en',
        clientUid: config?.clientUid,
    };
}
//# sourceMappingURL=config.js.map