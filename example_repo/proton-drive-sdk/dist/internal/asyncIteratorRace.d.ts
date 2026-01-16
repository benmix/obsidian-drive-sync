/**
 * Races multiple async iterators into a single async iterator.
 *
 * The input iterators are provided as an async iterator that yields async
 * iterators. This allows to create the iterators lazily, e.g., when the
 * input iterators are created from a database query.
 *
 * The number of input iterators being read at the same time is limited by
 * the `concurrency` parameter.
 *
 * Any error from the input iterators is propagated to the output iterator.
 */
export declare function asyncIteratorRace<T>(inputIterators: AsyncGenerator<AsyncGenerator<T>>, concurrency?: number): AsyncGenerator<T>;
