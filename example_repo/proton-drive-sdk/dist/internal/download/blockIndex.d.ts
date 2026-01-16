export declare const DEFAULT_FILE_CHUNK_SIZE: number;
export declare function getBlockIndex(claimedBlockSizes: number[] | undefined, position: number): {
    done: false;
    value: {
        blockIndex: number;
        blockOffset: number;
    };
} | {
    done: true;
    value: undefined;
};
