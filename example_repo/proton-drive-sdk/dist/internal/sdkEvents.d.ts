import { ProtonDriveTelemetry, SDKEvent } from '../interface';
export declare class SDKEvents {
    private logger;
    private listeners;
    constructor(telemetry: ProtonDriveTelemetry);
    addListener(eventName: SDKEvent, callback: () => void): () => void;
    transfersPaused(): void;
    transfersResumed(): void;
    requestsThrottled(): void;
    requestsUnthrottled(): void;
    private emit;
}
