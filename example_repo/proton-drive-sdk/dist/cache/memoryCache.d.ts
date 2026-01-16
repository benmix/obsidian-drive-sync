import type { ProtonDriveCache, EntityResult } from './interface';
/**
 * In-memory cache implementation for Proton Drive SDK.
 *
 * This cache is not persistent and is intended for mostly for testing or
 * development only. It is not recommended to use this cache in production
 * environments.
 */
export declare class MemoryCache<T> implements ProtonDriveCache<T> {
    private entities;
    private entitiesByTag;
    clear(): Promise<void>;
    setEntity(key: string, value: T, tags?: string[]): Promise<void>;
    getEntity(key: string): Promise<T>;
    iterateEntities(keys: string[]): AsyncGenerator<EntityResult<T>>;
    iterateEntitiesByTag(tag: string): AsyncGenerator<EntityResult<T>>;
    removeEntities(keys: string[]): Promise<void>;
}
