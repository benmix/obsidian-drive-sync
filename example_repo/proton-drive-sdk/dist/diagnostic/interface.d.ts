import { Author, MaybeNode, MetricEvent, NodeType, AnonymousUser } from '../interface';
import { LogRecord } from '../telemetry';
export interface Diagnostic {
    verifyMyFiles(options?: DiagnosticOptions, onProgress?: DiagnosticProgressCallback): AsyncGenerator<DiagnosticResult>;
    verifyNodeTree(node: MaybeNode, options?: DiagnosticOptions, onProgress?: DiagnosticProgressCallback): AsyncGenerator<DiagnosticResult>;
    verifyPhotosTimeline(options?: DiagnosticOptions, onProgress?: DiagnosticProgressCallback): AsyncGenerator<DiagnosticResult>;
    getNodeTreeStructure(node: MaybeNode): Promise<TreeNode>;
    getPhotosTimelineStructure(): Promise<TreeNode>;
}
export type DiagnosticOptions = {
    verifyContent?: boolean | 'peakOnly';
    verifyThumbnails?: boolean;
    expectedStructure?: ExpectedTreeNode;
};
export type ExpectedTreeNode = {
    name: string;
    expectedMediaType?: string;
    expectedSha1?: string;
    expectedSizeInBytes?: number;
    expectedAuthors?: ExpectedAuthor | {
        key?: ExpectedAuthor;
        name?: ExpectedAuthor;
        content?: ExpectedAuthor;
    };
    children?: ExpectedTreeNode[];
};
export type TreeNode = {
    uid: string;
    type: NodeType;
    error?: unknown;
    name: string;
    claimedSha1?: string;
    claimedSizeInBytes?: number;
    children?: TreeNode[];
};
export type ExpectedAuthor = string | 'anonymous';
export type DiagnosticProgressCallback = (progress: {
    allNodesLoaded: boolean;
    loadedNodes: number;
    checkedNodes: number;
}) => void;
export type DiagnosticResult = FatalErrorResult | SdkErrorResult | HttpErrorResult | DegradedNodeResult | UnverifiedAuthorResult | ExtendedAttributesErrorResult | ExtendedAttributesMissingFieldResult | ContentFileMissingRevisionResult | ContentIntegrityErrorResult | ContentDownloadErrorResult | ThumbnailsErrorResult | ExpectedStructureMissingNode | ExpectedStructureUnexpectedNode | ExpectedStructureIntegrityError | LogErrorResult | LogWarningResult | MetricResult;
export type FatalErrorResult = {
    type: 'fatal_error';
    message: string;
    error?: unknown;
};
export type SdkErrorResult = {
    type: 'sdk_error';
    call: string;
    error?: unknown;
};
export type HttpErrorResult = {
    type: 'http_error';
    request: {
        url: string;
        method: string;
        json: unknown;
    };
    error?: unknown;
    response?: {
        status: number;
        statusText: string;
        json?: object;
        jsonError?: unknown;
    };
};
export type DegradedNodeResult = {
    type: 'degraded_node';
} & NodeDetails;
export type UnverifiedAuthorResult = {
    type: 'unverified_author';
    authorType: string;
    claimedAuthor?: string | AnonymousUser;
    error: string;
} & NodeDetails;
export type ExtendedAttributesErrorResult = {
    type: 'extended_attributes_error';
    field: 'sha1';
    value: string;
} & NodeDetails;
export type ExtendedAttributesMissingFieldResult = {
    type: 'extended_attributes_missing_field';
    missingField: 'sha1';
} & NodeDetails;
export type ContentFileMissingRevisionResult = {
    type: 'content_file_missing_revision';
} & NodeDetails;
export type ContentIntegrityErrorResult = {
    type: 'content_integrity_error';
    claimedSha1?: string;
    computedSha1?: string;
    claimedSizeInBytes?: number;
    computedSizeInBytes?: number;
} & NodeDetails;
export type ContentDownloadErrorResult = {
    type: 'content_download_error';
    error: unknown;
} & NodeDetails;
export type ThumbnailsErrorResult = {
    type: 'thumbnails_error';
    error: unknown;
} & NodeDetails;
export type ExpectedStructureMissingNode = {
    type: 'expected_structure_missing_node';
    expectedNode: ExpectedTreeNode;
    parentNodeUid: string;
};
export type ExpectedStructureUnexpectedNode = {
    type: 'expected_structure_unexpected_node';
} & NodeDetails;
export type ExpectedStructureIntegrityError = {
    type: 'expected_structure_integrity_error';
    expectedNode: ExpectedTreeNode;
    claimedSha1?: string;
    claimedSizeInBytes?: number;
} & NodeDetails;
export type LogErrorResult = {
    type: 'log_error';
    log: LogRecord;
};
export type LogWarningResult = {
    type: 'log_warning';
    log: LogRecord;
};
export type MetricResult = {
    type: 'metric';
    event: MetricEvent;
};
export type NodeDetails = {
    safeNodeDetails: {
        nodeUid: string;
        revisionUid: string | undefined;
        nodeType: NodeType;
        mediaType: string | undefined;
        nodeCreationTime: Date;
        keyAuthor: Author;
        nameAuthor: Author;
        contentAuthor: Author | undefined;
        errors: {
            field: string;
            error: unknown;
        }[];
    };
    sensitiveNodeDetails: MaybeNode;
};
