"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadQueue = void 0;
const wait_1 = require("../wait");
/**
 * A queue that limits the number of concurrent downloads.
 *
 * This is used to limit the number of concurrent downloads to avoid
 * overloading the server, or get rate limited.
 *
 * Each file download consumes memory and is limited by the number of
 * concurrent block downloads for each file.
 *
 * This queue is straitforward and does not have any priority mechanism
 * or other features, such as limiting total number of blocks being
 * downloaded. That is something we want to add in the future to be
 * more performant for many small file downloads.
 */
const MAX_CONCURRENT_DOWNLOADS = 5;
class DownloadQueue {
    capacity = 0;
    async waitForCapacity(signal) {
        await (0, wait_1.waitForCondition)(() => this.capacity < MAX_CONCURRENT_DOWNLOADS, signal);
        this.capacity++;
    }
    releaseCapacity() {
        this.capacity--;
    }
}
exports.DownloadQueue = DownloadQueue;
//# sourceMappingURL=queue.js.map