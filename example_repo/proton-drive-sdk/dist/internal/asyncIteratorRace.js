"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncIteratorRace = asyncIteratorRace;
const DEFAULT_CONCURRENCY = 10;
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
async function* asyncIteratorRace(inputIterators, concurrency = DEFAULT_CONCURRENCY) {
    const promises = new Map();
    let nextIteratorIndex = 0;
    let inputIteratorsExhausted = false;
    const activeIterators = new Map();
    const startNewIterator = async () => {
        if (inputIteratorsExhausted || activeIterators.size >= concurrency) {
            return;
        }
        const nextIteratorResult = await inputIterators.next();
        if (nextIteratorResult.done) {
            inputIteratorsExhausted = true;
            return;
        }
        const iterator = nextIteratorResult.value;
        const iteratorIndex = nextIteratorIndex++;
        activeIterators.set(iteratorIndex, iterator);
        promises.set(iteratorIndex, (async () => {
            const result = await iterator.next();
            return { iteratorIndex, result };
        })());
    };
    while (activeIterators.size < concurrency && !inputIteratorsExhausted) {
        await startNewIterator();
    }
    while (promises.size > 0) {
        const { iteratorIndex, result } = await Promise.race(promises.values());
        promises.delete(iteratorIndex);
        if (result.done) {
            activeIterators.delete(iteratorIndex);
            await startNewIterator();
        }
        else {
            yield result.value;
            const iterator = activeIterators.get(iteratorIndex);
            promises.set(iteratorIndex, (async () => {
                const result = await iterator.next();
                return { iteratorIndex, result };
            })());
        }
    }
}
//# sourceMappingURL=asyncIteratorRace.js.map