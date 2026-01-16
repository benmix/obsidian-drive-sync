"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../../errors");
const queue_1 = require("./queue");
const streamUploader_1 = require("./streamUploader");
describe('UploadQueue', () => {
    let queue;
    beforeEach(() => {
        queue = new queue_1.UploadQueue();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should resolve immediately when queue is empty', async () => {
        const promise = queue.waitForCapacity(0);
        await promise;
    });
    it('should resolve immediately when under file upload limit', async () => {
        // Fill queue with 4 uploads (limit is 5)
        for (let i = 0; i < 4; i++) {
            await queue.waitForCapacity(0);
        }
        const promise = queue.waitForCapacity(0);
        await promise;
    });
    it('should wait when max concurrent file uploads is reached', async () => {
        // Fill queue to max (5 uploads)
        for (let i = 0; i < 5; i++) {
            await queue.waitForCapacity(0);
        }
        let resolved = false;
        const promise = queue.waitForCapacity(0).then(() => {
            resolved = true;
        });
        await jest.advanceTimersByTimeAsync(100);
        expect(resolved).toBe(false);
        queue.releaseCapacity(0);
        await jest.advanceTimersByTimeAsync(100);
        await promise;
        expect(resolved).toBe(true);
    });
    it('should wait when max concurrent upload size is reached', async () => {
        // Fill queue with one large file that exceeds size limit
        const largeSize = 10 * streamUploader_1.FILE_CHUNK_SIZE;
        await queue.waitForCapacity(largeSize);
        let resolved = false;
        const promise = queue.waitForCapacity(0).then(() => {
            resolved = true;
        });
        await jest.advanceTimersByTimeAsync(100);
        expect(resolved).toBe(false);
        queue.releaseCapacity(largeSize);
        await jest.advanceTimersByTimeAsync(100);
        await promise;
        expect(resolved).toBe(true);
    });
    it('should track expected size correctly', async () => {
        const size1 = 5 * streamUploader_1.FILE_CHUNK_SIZE;
        const size2 = 4 * streamUploader_1.FILE_CHUNK_SIZE;
        await queue.waitForCapacity(size1);
        await queue.waitForCapacity(size2);
        // Total is 9 * FILE_CHUNK_SIZE, limit is 10 * FILE_CHUNK_SIZE
        // So next upload should still be allowed immediately
        const promise = queue.waitForCapacity(3 * streamUploader_1.FILE_CHUNK_SIZE);
        await promise;
        // But now we're at limit, next one should wait
        let resolved = false;
        const waitingPromise = queue.waitForCapacity(0).then(() => {
            resolved = true;
        });
        await jest.advanceTimersByTimeAsync(100);
        expect(resolved).toBe(false);
        queue.releaseCapacity(size1);
        await jest.advanceTimersByTimeAsync(100);
        await waitingPromise;
        expect(resolved).toBe(true);
    });
    it('should reject when signal is aborted', async () => {
        // Fill queue to max
        for (let i = 0; i < 5; i++) {
            await queue.waitForCapacity(0);
        }
        const controller = new AbortController();
        const promise = queue.waitForCapacity(0, controller.signal);
        controller.abort();
        // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
        const expectation = expect(promise).rejects.toThrow(errors_1.AbortError);
        await jest.advanceTimersByTimeAsync(50);
        await expectation;
    });
    it('should reject immediately if signal is already aborted', async () => {
        // Fill queue to max
        for (let i = 0; i < 5; i++) {
            await queue.waitForCapacity(0);
        }
        const controller = new AbortController();
        controller.abort();
        const promise = queue.waitForCapacity(0, controller.signal);
        await expect(promise).rejects.toThrow(errors_1.AbortError);
    });
});
//# sourceMappingURL=queue.test.js.map