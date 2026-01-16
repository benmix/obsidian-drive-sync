"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const batchLoading_1 = require("./batchLoading");
describe('BatchLoading', () => {
    let batchLoading;
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should load in batches with loadItems', async () => {
        const loadItems = jest.fn((items) => Promise.resolve(items.map((item) => `loaded:${item}`)));
        batchLoading = new batchLoading_1.BatchLoading({ loadItems, batchSize: 2 });
        const result = [];
        for (const item of ['a', 'b', 'c', 'd', 'e']) {
            for await (const loadedItem of batchLoading.load(item)) {
                result.push(loadedItem);
            }
        }
        for await (const loadedItem of batchLoading.loadRest()) {
            result.push(loadedItem);
        }
        expect(result).toEqual(['loaded:a', 'loaded:b', 'loaded:c', 'loaded:d', 'loaded:e']);
        expect(loadItems).toHaveBeenCalledTimes(3);
        expect(loadItems).toHaveBeenNthCalledWith(1, ['a', 'b']);
        expect(loadItems).toHaveBeenNthCalledWith(2, ['c', 'd']);
        expect(loadItems).toHaveBeenNthCalledWith(3, ['e']);
    });
    it('should load in batches with iterateItems', async () => {
        const iterateItems = jest.fn(async function* (items) {
            for (const item of items) {
                yield `loaded:${item}`;
            }
        });
        batchLoading = new batchLoading_1.BatchLoading({ iterateItems, batchSize: 2 });
        const result = [];
        for (const item of ['a', 'b', 'c', 'd', 'e']) {
            for await (const loadedItem of batchLoading.load(item)) {
                result.push(loadedItem);
            }
        }
        for await (const loadedItem of batchLoading.loadRest()) {
            result.push(loadedItem);
        }
        expect(result).toEqual(['loaded:a', 'loaded:b', 'loaded:c', 'loaded:d', 'loaded:e']);
        expect(iterateItems).toHaveBeenCalledTimes(3);
        expect(iterateItems).toHaveBeenNthCalledWith(1, ['a', 'b']);
        expect(iterateItems).toHaveBeenNthCalledWith(2, ['c', 'd']);
        expect(iterateItems).toHaveBeenNthCalledWith(3, ['e']);
    });
});
//# sourceMappingURL=batchLoading.test.js.map