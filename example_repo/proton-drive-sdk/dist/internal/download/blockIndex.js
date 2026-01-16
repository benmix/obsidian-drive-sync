"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FILE_CHUNK_SIZE = void 0;
exports.getBlockIndex = getBlockIndex;
exports.DEFAULT_FILE_CHUNK_SIZE = 4 * 1024 * 1024;
function getBlockIndex(claimedBlockSizes, position) {
    if (!claimedBlockSizes || claimedBlockSizes.length === 0) {
        return {
            value: {
                blockIndex: Math.floor(position / exports.DEFAULT_FILE_CHUNK_SIZE) + 1,
                blockOffset: position % exports.DEFAULT_FILE_CHUNK_SIZE,
            },
            done: false,
        };
    }
    let currentPosition = 0;
    for (let i = 0; i < claimedBlockSizes.length; i++) {
        const blockSize = claimedBlockSizes[i];
        if (position < currentPosition + blockSize) {
            return {
                value: {
                    blockIndex: i + 1,
                    blockOffset: position - currentPosition,
                },
                done: false,
            };
        }
        currentPosition += blockSize;
    }
    return {
        value: undefined,
        done: true,
    };
}
//# sourceMappingURL=blockIndex.js.map