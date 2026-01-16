import { ProtonDrivePhotosClient } from '../protonDrivePhotosClient';
import { DiagnosticOptions, DiagnosticProgressCallback, DiagnosticResult, ExpectedTreeNode, TreeNode } from './interface';
import { SDKDiagnosticBase } from './sdkDiagnosticBase';
/**
 * Diagnostic tool that uses the Photos SDK to traverse and verify
 * the integrity of the Photos in the timeline.
 */
export declare class SDKDiagnosticPhotos extends SDKDiagnosticBase {
    private protonDrivePhotosClient;
    constructor(protonDrivePhotosClient: ProtonDrivePhotosClient, options?: Pick<DiagnosticOptions, 'verifyContent' | 'verifyThumbnails'>, onProgress?: DiagnosticProgressCallback);
    verifyTimeline(expectedStructure?: ExpectedTreeNode): AsyncGenerator<DiagnosticResult>;
    private loadTimeline;
    getStructure(): Promise<TreeNode>;
}
