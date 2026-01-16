import { MaybeNode } from '../interface';
import { ProtonDriveClient } from '../protonDriveClient';
import { ProtonDrivePhotosClient } from '../protonDrivePhotosClient';
import { DiagnosticHTTPClient } from './httpClient';
import { DiagnosticOptions, DiagnosticProgressCallback, DiagnosticResult, TreeNode } from './interface';
import { DiagnosticTelemetry } from './telemetry';
/**
 * Diagnostic tool that produces full diagnostic, including logs and metrics
 * by reading the events from the telemetry and HTTP client.
 */
export declare class Diagnostic {
    private telemetry;
    private httpClient;
    private protonDriveClient;
    private protonDrivePhotosClient;
    constructor(telemetry: DiagnosticTelemetry, httpClient: DiagnosticHTTPClient, protonDriveClient: ProtonDriveClient, protonDrivePhotosClient: ProtonDrivePhotosClient);
    verifyMyFiles(options?: DiagnosticOptions, onProgress?: DiagnosticProgressCallback): AsyncGenerator<DiagnosticResult>;
    verifyNodeTree(node: MaybeNode, options?: DiagnosticOptions, onProgress?: DiagnosticProgressCallback): AsyncGenerator<DiagnosticResult>;
    verifyPhotosTimeline(options?: DiagnosticOptions, onProgress?: DiagnosticProgressCallback): AsyncGenerator<DiagnosticResult>;
    private yieldEvents;
    private internalGenerator;
    getNodeTreeStructure(node: MaybeNode): Promise<TreeNode>;
    getPhotosTimelineStructure(): Promise<TreeNode>;
}
