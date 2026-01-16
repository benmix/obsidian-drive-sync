"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullCache = void 0;
/**
 * Null cache implementation for Proton Drive SDK.
 *
 * This cache is not caching anything. It can be used to disable the cache.
 */
class NullCache {
    async clear() {
        // No-op.
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async setEntity(key, value, tags) {
        // No-op.
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getEntity(key) {
        throw Error('Entity not found');
    }
    async *iterateEntities(keys) {
        for (const key of keys) {
            yield { key, ok: false, error: 'Entity not found' };
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async *iterateEntitiesByTag(tag) {
        // No-op.
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async removeEntities(keys) {
        // No-op.
    }
}
exports.NullCache = NullCache;
//# sourceMappingURL=nullCache.js.map