"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncIteratorRace_1 = require("./asyncIteratorRace");
async function* createInputIterator(generators) {
    for (const generator of generators) {
        yield generator;
    }
}
async function* createAsyncGenerator(values, delay = 0) {
    for (const value of values) {
        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        yield value;
    }
}
function createTrackingGenerator(values, trackingSet, id, delay = 10) {
    return (async function* () {
        trackingSet.add(id);
        try {
            for (const value of values) {
                await new Promise((resolve) => setTimeout(resolve, delay));
                yield value;
            }
        }
        finally {
            trackingSet.delete(id);
        }
    })();
}
describe('asyncIteratorRace', () => {
    it('should handle empty input iterator', async () => {
        async function* emptyInput() {
            return;
        }
        const result = (0, asyncIteratorRace_1.asyncIteratorRace)(emptyInput());
        const values = await Array.fromAsync(result);
        expect(values).toEqual([]);
    });
    it('should handle single generator with no values', async () => {
        const input = createInputIterator([createAsyncGenerator([])]);
        const result = (0, asyncIteratorRace_1.asyncIteratorRace)(input);
        const values = await Array.fromAsync(result);
        expect(values).toEqual([]);
    });
    it('should handle single generator with multiple values', async () => {
        const input = createInputIterator([createAsyncGenerator([1, 2, 3])]);
        const result = (0, asyncIteratorRace_1.asyncIteratorRace)(input);
        const values = await Array.fromAsync(result);
        expect(values).toEqual([1, 2, 3]);
    });
    it('should handle generators with mixed empty and non-empty results', async () => {
        const input = createInputIterator([
            createAsyncGenerator([]),
            createAsyncGenerator([1, 3]),
            createAsyncGenerator([]),
            createAsyncGenerator([2]),
        ]);
        const result = (0, asyncIteratorRace_1.asyncIteratorRace)(input);
        const values = await Array.fromAsync(result);
        expect(values.sort()).toEqual([1, 2, 3]);
    });
    it('should limit concurrent reading of input iterators', async () => {
        const concurrency = 2;
        const activeIterators = new Set();
        let maxConcurrentActive = 0;
        const generators = Array.from({ length: 5 }, (_, i) => createTrackingGenerator([i * 10, i * 10 + 1], activeIterators, i, 50));
        const input = createInputIterator(generators);
        const result = (0, asyncIteratorRace_1.asyncIteratorRace)(input, concurrency);
        const values = [];
        for await (const value of result) {
            maxConcurrentActive = Math.max(maxConcurrentActive, activeIterators.size);
            values.push(value);
        }
        expect(maxConcurrentActive).toBe(concurrency);
        expect(values).toHaveLength(10);
        expect(values.sort()).toEqual([0, 1, 10, 11, 20, 21, 30, 31, 40, 41]);
    });
    it('should yield values as soon as any generator yields', async () => {
        const slowGenerator = (async function* () {
            await new Promise((resolve) => setTimeout(resolve, 100));
            yield 'slow';
        })();
        const fastGenerator = (async function* () {
            await new Promise((resolve) => setTimeout(resolve, 50));
            yield 'fast';
        })();
        const input = createInputIterator([slowGenerator, fastGenerator]);
        const result = (0, asyncIteratorRace_1.asyncIteratorRace)(input, 2);
        const yieldTimes = [];
        const startTime = Date.now();
        const values = [];
        for await (const value of result) {
            yieldTimes.push(Date.now() - startTime);
            values.push(value);
        }
        expect(values).toEqual(['fast', 'slow']);
        expect(yieldTimes[0]).toBeGreaterThan(40);
        expect(yieldTimes[0]).toBeLessThan(60);
        expect(yieldTimes[1]).toBeGreaterThan(90);
        expect(yieldTimes[1]).toBeLessThan(110);
    });
    it('should propagate errors from input iterators', async () => {
        const errorGenerator = (async function* () {
            yield 'before-error';
            throw new Error('Test error');
        })();
        const input = createInputIterator([errorGenerator]);
        const result = (0, asyncIteratorRace_1.asyncIteratorRace)(input);
        const values = [];
        await expect(async () => {
            for await (const value of result) {
                values.push(value);
            }
        }).rejects.toThrow('Test error');
        expect(values).toEqual(['before-error']);
    });
});
//# sourceMappingURL=asyncIteratorRace.test.js.map