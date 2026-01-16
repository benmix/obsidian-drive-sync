/**
 * Maps values from an input iterator and produces a new iterator.
 * The mapper function is not awaited immediately to allow for parallel
 * execution. The order of the items in the output iterator is not the
 * same as the order of the items in the input iterator.
 *
 * Any error from the input iterator or the mapper function is propagated
 * to the output iterator.
 *
 * @param inputIterator - The input async iterator.
 * @param mapper - The mapper function that maps the input values to output values.
 * @param concurrency - The concurrency limit. How many parallel async mapper calls are allowed.
 * @returns An async iterator that yields the mapped values.
 */
export declare function asyncIteratorMap<I, O>(inputIterator: AsyncGenerator<I>, mapper: (item: I) => Promise<O>, concurrency?: number, signal?: AbortSignal): AsyncGenerator<O>;
