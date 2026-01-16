export declare class DownloadController {
    private signal?;
    private paused;
    promise?: Promise<void>;
    private _isDownloadCompleteWithSignatureIssues;
    constructor(signal?: AbortSignal | undefined);
    waitWhilePaused(): Promise<void>;
    pause(): void;
    resume(): void;
    completion(): Promise<void>;
    isDownloadCompleteWithSignatureIssues(): boolean;
    setIsDownloadCompleteWithSignatureIssues(value: boolean): void;
}
