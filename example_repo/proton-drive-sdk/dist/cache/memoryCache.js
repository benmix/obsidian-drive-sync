"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryCache = void 0;
/**
 * In-memory cache implementation for Proton Drive SDK.
 *
 * This cache is not persistent and is intended for mostly for testing or
 * development only. It is not recommended to use this cache in production
 * environments.
 */
class MemoryCache {
    entities = {};
    entitiesByTag = {};
    async clear() {
        this.entities = {};
    }
    async setEntity(key, value, tags) {
        this.entities[key] = value;
        for (const tag of Object.keys(this.entitiesByTag)) {
            const index = this.entitiesByTag[tag].indexOf(key);
            if (index !== -1) {
                this.entitiesByTag[tag].splice(index, 1);
                if (this.entitiesByTag[tag].length === 0) {
                    delete this.entitiesByTag[tag];
                }
            }
        }
        if (tags) {
            for (const tag of tags) {
                if (!this.entitiesByTag[tag]) {
                    this.entitiesByTag[tag] = [];
                }
                this.entitiesByTag[tag].push(key);
            }
        }
    }
    async getEntity(key) {
        const value = this.entities[key];
        if (!value) {
            throw Error('Entity not found');
        }
        return value;
    }
    async *iterateEntities(keys) {
        for (const key of keys) {
            try {
                const value = await this.getEntity(key);
                yield { key, ok: true, value };
            }
            catch (error) {
                yield { key, ok: false, error: `${error}` };
            }
        }
    }
    async *iterateEntitiesByTag(tag) {
        const keys = this.entitiesByTag[tag];
        if (!keys) {
            return;
        }
        // Pass copy of keys so concurrent changes to the cache do not affect
        // results from iterating entities.
        yield* this.iterateEntities([...keys]);
    }
    async removeEntities(keys) {
        for (const key of keys) {
            delete this.entities[key];
            Object.values(this.entitiesByTag).forEach((tagKeys) => {
                const index = tagKeys.indexOf(key);
                if (index !== -1) {
                    tagKeys.splice(index, 1);
                }
            });
        }
    }
}
exports.MemoryCache = MemoryCache;
//# sourceMappingURL=memoryCache.js.map