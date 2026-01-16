/**
 * Zips two generators into one.
 *
 * The combined generator yields values from both generators in the order they
 * are produced.
 */
export declare function zipGenerators<T, U>(genA: AsyncGenerator<T>, genB: AsyncGenerator<U>, options?: {
    stopOnFirstDone?: boolean;
}): AsyncGenerator<T | U>;
