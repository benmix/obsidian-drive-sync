"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batch = batch;
function* batch(items, batchSize) {
    if (batchSize <= 0) {
        throw new Error('Batch size must be greater than 0');
    }
    for (let i = 0; i < items.length; i += batchSize) {
        yield items.slice(i, i + batchSize);
    }
}
//# sourceMappingURL=batch.js.map