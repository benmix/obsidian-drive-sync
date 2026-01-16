import type { ProtonDriveCache, EntityResult } from './interface';
/**
 * Null cache implementation for Proton Drive SDK.
 *
 * This cache is not caching anything. It can be used to disable the cache.
 */
export declare class NullCache<T> implements ProtonDriveCache<T> {
    clear(): Promise<void>;
    setEntity(key: string, value: T, tags?: string[]): Promise<void>;
    getEntity(key: string): Promise<T>;
    iterateEntities(keys: string[]): AsyncGenerator<EntityResult<T>>;
    iterateEntitiesByTag(tag: string): AsyncGenerator<EntityResult<T>>;
    removeEntities(keys: string[]): Promise<void>;
}
