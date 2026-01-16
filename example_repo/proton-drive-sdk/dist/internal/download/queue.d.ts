export declare class DownloadQueue {
    private capacity;
    waitForCapacity(signal?: AbortSignal): Promise<void>;
    releaseCapacity(): void;
}
