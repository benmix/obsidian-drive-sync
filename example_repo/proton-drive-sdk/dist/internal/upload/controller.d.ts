export declare class UploadController {
    private signal?;
    private paused;
    promise?: Promise<{
        nodeRevisionUid: string;
        nodeUid: string;
    }>;
    constructor(signal?: AbortSignal | undefined);
    waitWhilePaused(): Promise<void>;
    pause(): void;
    resume(): void;
    completion(): Promise<{
        nodeRevisionUid: string;
        nodeUid: string;
    }>;
}
