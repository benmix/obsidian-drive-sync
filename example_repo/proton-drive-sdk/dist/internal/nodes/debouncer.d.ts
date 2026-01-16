import { ProtonDriveTelemetry } from '../../interface';
/**
 * Helper to avoid loading the same node twice.
 *
 * Each place that loads a node should report it is being loaded,
 * and when it is finished, it should report it is finished.
 * The finish must be called even if the node fails to be loaded
 * to clear the promise.
 *
 * Each place that loads a node from cache should first wait for
 * the node to be loaded if that is the case.
 */
export declare class NodesDebouncer {
    private telemetry;
    private logger;
    private promises;
    constructor(telemetry: ProtonDriveTelemetry);
    loadingNodes(nodeUids: string[]): void;
    loadingNode(nodeUid: string): void;
    finishedLoadingNodes(nodeUids: string[]): void;
    finishedLoadingNode(nodeUid: string): void;
    waitForLoadingNode(nodeUid: string): Promise<void>;
    clear(): void;
}
