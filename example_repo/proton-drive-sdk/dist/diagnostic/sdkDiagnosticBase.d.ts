import { FileDownloader, MaybeNode, NodeOrUid, ThumbnailType, ThumbnailResult } from '../interface';
import { DiagnosticOptions, DiagnosticResult, ExpectedTreeNode, DiagnosticProgressCallback } from './interface';
interface SDKClient {
    getFileDownloader(nodeOrUid: NodeOrUid): Promise<FileDownloader>;
    iterateThumbnails(nodeUids: string[], thumbnailType: ThumbnailType): AsyncGenerator<ThumbnailResult>;
}
/**
 * Base class for all SDK diagnostic tools that verifies the integrity of
 * the individual nodes.
 */
export declare class SDKDiagnosticBase {
    private sdkClient;
    private options;
    private onProgress?;
    private progressReportInterval;
    protected nodesQueue: {
        node: MaybeNode;
        expected?: ExpectedTreeNode;
    }[];
    protected allNodesLoaded: boolean;
    protected loadedNodes: number;
    protected checkedNodes: number;
    constructor(sdkClient: SDKClient, options?: Pick<DiagnosticOptions, 'verifyContent' | 'verifyThumbnails'>, onProgress?: DiagnosticProgressCallback);
    protected startProgress(): void;
    protected finishProgress(): void;
    private reportProgress;
    protected verifyExpectedNodeChildren(parentNodeUid: string, children: MaybeNode[], expectedStructure?: ExpectedTreeNode): AsyncGenerator<DiagnosticResult>;
    protected verifyNodesQueue(): AsyncGenerator<DiagnosticResult>;
    private verifyNode;
    private verifyAuthor;
    private verifyFileExtendedAttributes;
    private verifyContentPeak;
    private verifyContent;
    private verifyThumbnails;
}
export {};
