"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = require("../../cache");
const logger_1 = require("../../tests/logger");
const cache_2 = require("./cache");
describe('sharesCache', () => {
    let memoryCache;
    let cache;
    beforeEach(async () => {
        memoryCache = new cache_1.MemoryCache();
        await memoryCache.setEntity('volume-badObject', 'aaa');
        cache = new cache_2.SharesCache((0, logger_1.getMockLogger)(), memoryCache);
    });
    it('should store and retrieve volume', async () => {
        const volumeId = 'volume1';
        const volume = {
            volumeId,
            shareId: 'share1',
            rootNodeId: 'node1',
            creatorEmail: 'email',
            addressId: 'address1',
        };
        await cache.setVolume(volume);
        const result = await cache.getVolume(volumeId);
        expect(result).toStrictEqual(volume);
    });
    it('should throw an error when retrieving a non-existing entity', async () => {
        const volumeId = 'newVolumeId';
        try {
            await cache.getVolume(volumeId);
            fail('Should have thrown an error');
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Entity not found');
        }
    });
    it('should throw an error when retrieving a bad keys and remove the key', async () => {
        try {
            await cache.getVolume('badObject');
            fail('Should have thrown an error');
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Failed to deserialize volume: Unexpected token \'a\', \"aaa\" is not valid JSON');
        }
        try {
            await memoryCache.getEntity('volumes-badObject');
            fail('Should have thrown an error');
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Entity not found');
        }
    });
});
//# sourceMappingURL=cache.test.js.map