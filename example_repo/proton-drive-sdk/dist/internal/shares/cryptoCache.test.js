"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = require("../../cache");
const logger_1 = require("../../tests/logger");
const cryptoCache_1 = require("./cryptoCache");
describe('sharesCryptoCache', () => {
    let memoryCache;
    let cache;
    const generatePrivateKey = (name) => {
        return name;
    };
    const generateSessionKey = (name) => {
        return name;
    };
    beforeEach(() => {
        memoryCache = new cache_1.MemoryCache();
        cache = new cryptoCache_1.SharesCryptoCache((0, logger_1.getMockLogger)(), memoryCache);
    });
    it('should store and retrieve keys', async () => {
        const shareId = 'newShareId';
        const keys = { key: generatePrivateKey('privateKey'), passphraseSessionKey: generateSessionKey('sessionKey') };
        await cache.setShareKey(shareId, keys);
        const result = await cache.getShareKey(shareId);
        expect(result).toStrictEqual(keys);
    });
    it('should replace and retrieve new keys', async () => {
        const shareId = 'newShareId';
        const keys1 = {
            key: generatePrivateKey('privateKey1'),
            passphraseSessionKey: generateSessionKey('sessionKey1'),
        };
        const keys2 = {
            key: generatePrivateKey('privateKey2'),
            passphraseSessionKey: generateSessionKey('sessionKey2'),
        };
        await cache.setShareKey(shareId, keys1);
        await cache.setShareKey(shareId, keys2);
        const result = await cache.getShareKey(shareId);
        expect(result).toStrictEqual(keys2);
    });
    it('should remove keys', async () => {
        const shareId = 'newShareId';
        const keys = { key: generatePrivateKey('privateKey'), passphraseSessionKey: generateSessionKey('sessionKey') };
        await cache.setShareKey(shareId, keys);
        await cache.removeShareKeys([shareId]);
        try {
            await cache.getShareKey(shareId);
            throw new Error('Should have thrown an error');
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Entity not found');
        }
    });
    it('should throw an error when retrieving a non-existing entity', async () => {
        const shareId = 'newShareId';
        try {
            await cache.getShareKey(shareId);
            throw new Error('Should have thrown an error');
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Entity not found');
        }
    });
});
//# sourceMappingURL=cryptoCache.test.js.map