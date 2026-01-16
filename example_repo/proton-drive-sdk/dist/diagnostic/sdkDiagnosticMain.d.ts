import { MaybeNode } from '../interface';
import { ProtonDriveClient } from '../protonDriveClient';
import { DiagnosticOptions, DiagnosticProgressCallback, DiagnosticResult, ExpectedTreeNode, TreeNode } from './interface';
import { SDKDiagnosticBase } from './sdkDiagnosticBase';
/**
 * Diagnostic tool that uses the main Drive SDK to traverse and verify
 * the integrity of the node tree.
 */
export declare class SDKDiagnosticMain extends SDKDiagnosticBase {
    private protonDriveClient;
    constructor(protonDriveClient: ProtonDriveClient, options?: Pick<DiagnosticOptions, 'verifyContent' | 'verifyThumbnails'>, onProgress?: DiagnosticProgressCallback);
    verifyMyFiles(expectedStructure?: ExpectedTreeNode): AsyncGenerator<DiagnosticResult>;
    verifyNodeTree(node: MaybeNode, expectedStructure?: ExpectedTreeNode): AsyncGenerator<DiagnosticResult>;
    private loadNodeTree;
    private loadNodeTreeRecursively;
    getStructure(node: MaybeNode): Promise<TreeNode>;
}
