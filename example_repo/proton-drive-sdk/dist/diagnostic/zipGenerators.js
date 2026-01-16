"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zipGenerators = zipGenerators;
/**
 * Zips two generators into one.
 *
 * The combined generator yields values from both generators in the order they
 * are produced.
 */
async function* zipGenerators(genA, genB, options) {
    const { stopOnFirstDone = false } = options || {};
    const itA = genA[Symbol.asyncIterator]();
    const itB = genB[Symbol.asyncIterator]();
    let promiseA = itA.next();
    let promiseB = itB.next();
    while (promiseA && promiseB) {
        const result = await Promise.race([
            promiseA.then((res) => ({ source: 'A', result: res })),
            promiseB.then((res) => ({ source: 'B', result: res })),
        ]);
        if (result.source === 'A') {
            if (result.result.done) {
                promiseA = undefined;
                if (stopOnFirstDone) {
                    break;
                }
            }
            else {
                yield result.result.value;
                promiseA = itA.next();
            }
        }
        else {
            if (result.result.done) {
                promiseB = undefined;
                if (stopOnFirstDone) {
                    break;
                }
            }
            else {
                yield result.result.value;
                promiseB = itB.next();
            }
        }
    }
    if (stopOnFirstDone) {
        return;
    }
    if (promiseA) {
        const result = await promiseA;
        if (!result.done) {
            yield result.value;
        }
        yield* itA;
    }
    if (promiseB) {
        const result = await promiseB;
        if (!result.done) {
            yield result.value;
        }
        yield* itB;
    }
}
//# sourceMappingURL=zipGenerators.js.map