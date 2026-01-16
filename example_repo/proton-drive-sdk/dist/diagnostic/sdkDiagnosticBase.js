"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKDiagnosticBase = void 0;
const interface_1 = require("../interface");
const integrityVerificationStream_1 = require("./integrityVerificationStream");
const nodeUtils_1 = require("./nodeUtils");
const PROGRESS_REPORT_INTERVAL = 500;
/**
 * Base class for all SDK diagnostic tools that verifies the integrity of
 * the individual nodes.
 */
class SDKDiagnosticBase {
    sdkClient;
    options;
    onProgress;
    progressReportInterval;
    nodesQueue = [];
    allNodesLoaded = false;
    loadedNodes = 0;
    checkedNodes = 0;
    constructor(sdkClient, options, onProgress) {
        this.sdkClient = sdkClient;
        this.sdkClient = sdkClient;
        this.options = options || { verifyContent: false, verifyThumbnails: false };
        this.onProgress = onProgress;
    }
    startProgress() {
        this.allNodesLoaded = false;
        this.loadedNodes = 0;
        this.checkedNodes = 0;
        this.reportProgress();
        this.progressReportInterval = setInterval(() => {
            this.reportProgress();
        }, PROGRESS_REPORT_INTERVAL);
    }
    finishProgress() {
        if (this.progressReportInterval) {
            clearInterval(this.progressReportInterval);
            this.progressReportInterval = undefined;
        }
        this.reportProgress();
    }
    reportProgress() {
        this.onProgress?.({
            allNodesLoaded: this.allNodesLoaded,
            loadedNodes: this.loadedNodes,
            checkedNodes: this.checkedNodes,
        });
    }
    async *verifyExpectedNodeChildren(parentNodeUid, children, expectedStructure) {
        if (!expectedStructure) {
            return;
        }
        const expectedNodes = expectedStructure.children ?? [];
        const actualNodeNames = children.map((child) => (0, nodeUtils_1.getNodeName)(child));
        for (const expectedNode of expectedNodes) {
            if (!actualNodeNames.includes(expectedNode.name)) {
                yield {
                    type: 'expected_structure_missing_node',
                    expectedNode: (0, nodeUtils_1.getExpectedTreeNodeDetails)(expectedNode),
                    parentNodeUid,
                };
            }
        }
        for (const child of children) {
            const childName = (0, nodeUtils_1.getNodeName)(child);
            const isExpected = expectedNodes.some((expectedNode) => expectedNode.name === childName);
            if (!isExpected) {
                yield {
                    type: 'expected_structure_unexpected_node',
                    ...(0, nodeUtils_1.getNodeDetails)(child),
                };
            }
        }
    }
    async *verifyNodesQueue() {
        while (this.nodesQueue.length > 0 || !this.allNodesLoaded) {
            const result = this.nodesQueue.shift();
            if (result) {
                yield* this.verifyNode(result.node, result.expected);
                this.checkedNodes++;
            }
            else {
                // Wait for 100ms before checking again.
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
    }
    async *verifyNode(node, expectedStructure) {
        if (!node.ok) {
            yield {
                type: 'degraded_node',
                ...(0, nodeUtils_1.getNodeDetails)(node),
            };
        }
        yield* this.verifyAuthor(node.ok ? node.value.keyAuthor : node.error.keyAuthor, 'key', node, expectedStructure);
        yield* this.verifyAuthor(node.ok ? node.value.nameAuthor : node.error.nameAuthor, 'name', node, expectedStructure);
        const activeRevision = (0, nodeUtils_1.getActiveRevision)(node);
        if (activeRevision) {
            yield* this.verifyAuthor(activeRevision.contentAuthor, 'content', node, expectedStructure);
        }
        yield* this.verifyFileExtendedAttributes(node, expectedStructure);
        if (this.options.verifyContent === 'peakOnly') {
            yield* this.verifyContentPeak(node);
        }
        else if (this.options.verifyContent) {
            yield* this.verifyContent(node);
        }
        if (this.options.verifyThumbnails) {
            yield* this.verifyThumbnails(node);
        }
        if (expectedStructure?.expectedMediaType) {
            const mediaType = (0, nodeUtils_1.getMediaType)(node);
            if (mediaType !== expectedStructure.expectedMediaType) {
                yield {
                    type: 'expected_structure_integrity_error',
                    expectedNode: (0, nodeUtils_1.getExpectedTreeNodeDetails)(expectedStructure),
                    ...(0, nodeUtils_1.getNodeDetails)(node),
                };
            }
        }
    }
    async *verifyAuthor(author, authorType, node, expectedStructure) {
        if (!author.ok) {
            yield {
                type: 'unverified_author',
                authorType,
                claimedAuthor: author.error.claimedAuthor,
                error: author.error.error,
                ...(0, nodeUtils_1.getNodeDetails)(node),
            };
        }
        if (expectedStructure?.expectedAuthors) {
            let expectedEmail = typeof expectedStructure.expectedAuthors === 'string'
                ? expectedStructure.expectedAuthors
                : expectedStructure.expectedAuthors[authorType];
            if (expectedEmail === 'anonymous') {
                expectedEmail = null;
            }
            const email = author.ok ? author.value : author.error.claimedAuthor;
            if (expectedEmail !== undefined && email !== expectedEmail) {
                yield {
                    type: 'expected_structure_integrity_error',
                    expectedNode: (0, nodeUtils_1.getExpectedTreeNodeDetails)(expectedStructure),
                    ...(0, nodeUtils_1.getNodeDetails)(node),
                };
            }
        }
    }
    async *verifyFileExtendedAttributes(node, expectedStructure) {
        const activeRevision = (0, nodeUtils_1.getActiveRevision)(node);
        const expectedAttributes = (0, nodeUtils_1.getNodeType)(node) === interface_1.NodeType.File;
        const claimedSha1 = activeRevision?.claimedDigests?.sha1;
        const claimedSizeInBytes = activeRevision?.claimedSize;
        if (claimedSha1 && !/^[0-9a-f]{40}$/i.test(claimedSha1)) {
            yield {
                type: 'extended_attributes_error',
                field: 'sha1',
                value: claimedSha1,
                ...(0, nodeUtils_1.getNodeDetails)(node),
            };
        }
        if (expectedAttributes && !claimedSha1) {
            yield {
                type: 'extended_attributes_missing_field',
                missingField: 'sha1',
                ...(0, nodeUtils_1.getNodeDetails)(node),
            };
        }
        if (expectedStructure) {
            const expectedSha1 = expectedStructure.expectedSha1;
            const expectedSizeInBytes = expectedStructure.expectedSizeInBytes;
            const wrongSha1 = expectedSha1 !== undefined && claimedSha1 !== expectedSha1;
            const wrongSizeInBytes = expectedSizeInBytes !== undefined && claimedSizeInBytes !== expectedSizeInBytes;
            if (wrongSha1 || wrongSizeInBytes) {
                yield {
                    type: 'expected_structure_integrity_error',
                    claimedSha1,
                    claimedSizeInBytes,
                    expectedNode: (0, nodeUtils_1.getExpectedTreeNodeDetails)(expectedStructure),
                    ...(0, nodeUtils_1.getNodeDetails)(node),
                };
            }
        }
    }
    async *verifyContentPeak(node) {
        if ((0, nodeUtils_1.getNodeType)(node) !== interface_1.NodeType.File) {
            return;
        }
        let downloader;
        try {
            downloader = await this.sdkClient.getFileDownloader(node);
        }
        catch (error) {
            yield {
                type: 'sdk_error',
                call: `getFileDownloader(${node.ok ? node.value.uid : node.error.uid})`,
                error,
            };
            return;
        }
        try {
            const stream = downloader.getSeekableStream();
            const peak = await stream.read(1024);
            if (peak.value.length === 0) {
                yield {
                    type: 'content_download_error',
                    error: new Error('No data read'),
                    ...(0, nodeUtils_1.getNodeDetails)(node),
                };
            }
        }
        catch (error) {
            yield {
                type: 'content_download_error',
                error,
                ...(0, nodeUtils_1.getNodeDetails)(node),
            };
        }
    }
    async *verifyContent(node) {
        if ((0, nodeUtils_1.getNodeType)(node) !== interface_1.NodeType.File) {
            return;
        }
        const activeRevision = (0, nodeUtils_1.getActiveRevision)(node);
        if (!activeRevision) {
            yield {
                type: 'content_file_missing_revision',
                ...(0, nodeUtils_1.getNodeDetails)(node),
            };
            return;
        }
        let downloader;
        try {
            downloader = await this.sdkClient.getFileDownloader(node);
        }
        catch (error) {
            yield {
                type: 'sdk_error',
                call: `getFileDownloader(${node.ok ? node.value.uid : node.error.uid})`,
                error,
            };
            return;
        }
        const claimedSha1 = activeRevision.claimedDigests?.sha1;
        const claimedSizeInBytes = downloader.getClaimedSizeInBytes();
        const integrityVerificationStream = new integrityVerificationStream_1.IntegrityVerificationStream();
        const controller = downloader.downloadToStream(integrityVerificationStream);
        try {
            await controller.completion();
            const computedSha1 = integrityVerificationStream.computedSha1;
            const computedSizeInBytes = integrityVerificationStream.computedSizeInBytes;
            if (claimedSha1 !== computedSha1 || claimedSizeInBytes !== computedSizeInBytes) {
                yield {
                    type: 'content_integrity_error',
                    claimedSha1,
                    computedSha1,
                    claimedSizeInBytes,
                    computedSizeInBytes,
                    ...(0, nodeUtils_1.getNodeDetails)(node),
                };
            }
        }
        catch (error) {
            yield {
                type: 'content_download_error',
                error,
                ...(0, nodeUtils_1.getNodeDetails)(node),
            };
        }
    }
    async *verifyThumbnails(node) {
        if ((0, nodeUtils_1.getNodeType)(node) !== interface_1.NodeType.File) {
            return;
        }
        const nodeUid = node.ok ? node.value.uid : node.error.uid;
        try {
            const result = await Array.fromAsync(this.sdkClient.iterateThumbnails([nodeUid], interface_1.ThumbnailType.Type1));
            if (result.length === 0) {
                yield {
                    type: 'sdk_error',
                    call: `iterateThumbnails(${nodeUid})`,
                    error: new Error('No thumbnails found'),
                };
            }
            // TODO: We should have better way to check if the thumbnail is not expected.
            if (!result[0].ok && result[0].error !== 'Node has no thumbnail') {
                yield {
                    type: 'thumbnails_error',
                    error: result[0].error,
                    ...(0, nodeUtils_1.getNodeDetails)(node),
                };
            }
        }
        catch (error) {
            yield {
                type: 'sdk_error',
                call: `iterateThumbnails(${nodeUid})`,
                error,
            };
        }
    }
}
exports.SDKDiagnosticBase = SDKDiagnosticBase;
//# sourceMappingURL=sdkDiagnosticBase.js.map