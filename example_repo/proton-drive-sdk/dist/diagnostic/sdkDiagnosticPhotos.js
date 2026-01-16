"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKDiagnosticPhotos = void 0;
const zipGenerators_1 = require("./zipGenerators");
const nodeUtils_1 = require("./nodeUtils");
const sdkDiagnosticBase_1 = require("./sdkDiagnosticBase");
/**
 * Diagnostic tool that uses the Photos SDK to traverse and verify
 * the integrity of the Photos in the timeline.
 */
class SDKDiagnosticPhotos extends sdkDiagnosticBase_1.SDKDiagnosticBase {
    protonDrivePhotosClient;
    constructor(protonDrivePhotosClient, options, onProgress) {
        super(protonDrivePhotosClient, options, onProgress);
        this.protonDrivePhotosClient = protonDrivePhotosClient;
        this.protonDrivePhotosClient = protonDrivePhotosClient;
    }
    async *verifyTimeline(expectedStructure) {
        this.startProgress();
        yield* (0, zipGenerators_1.zipGenerators)(this.loadTimeline(expectedStructure), this.verifyNodesQueue());
        this.finishProgress();
    }
    async *loadTimeline(expectedStructure) {
        let nodeUids = [];
        try {
            const results = await Array.fromAsync(this.protonDrivePhotosClient.iterateTimeline());
            nodeUids = results.map((result) => result.nodeUid);
            this.loadedNodes = nodeUids.length;
        }
        catch (error) {
            yield {
                type: 'sdk_error',
                call: `iterateTimeline()`,
                error,
            };
        }
        const photos = [];
        try {
            for await (const maybeMissingNode of this.protonDrivePhotosClient.iterateNodes(nodeUids)) {
                if (!maybeMissingNode.ok && 'missingUid' in maybeMissingNode.error) {
                    continue;
                }
                const maybeNode = maybeMissingNode;
                photos.push(maybeNode);
                this.nodesQueue.push({
                    node: maybeNode,
                    expected: (0, nodeUtils_1.getTreeNodeChildByNodeName)(expectedStructure, (0, nodeUtils_1.getNodeName)(maybeNode)),
                });
            }
        }
        catch (error) {
            yield {
                type: 'sdk_error',
                call: `iterateNodes(...)`,
                error,
            };
        }
        if (expectedStructure) {
            yield* this.verifyExpectedNodeChildren('photo-timeline', photos, expectedStructure);
        }
        this.allNodesLoaded = true;
    }
    async getStructure() {
        const myPhotosRootFolder = await this.protonDrivePhotosClient.getMyPhotosRootFolder();
        const treeNode = {
            uid: myPhotosRootFolder.ok ? myPhotosRootFolder.value.uid : myPhotosRootFolder.error.uid,
            type: (0, nodeUtils_1.getNodeType)(myPhotosRootFolder),
            name: (0, nodeUtils_1.getNodeName)(myPhotosRootFolder),
        };
        const children = [];
        const results = await Array.fromAsync(this.protonDrivePhotosClient.iterateTimeline());
        const nodeUids = results.map((result) => result.nodeUid);
        for await (const maybeMissingNode of this.protonDrivePhotosClient.iterateNodes(nodeUids)) {
            if (!maybeMissingNode.ok && 'missingUid' in maybeMissingNode.error) {
                continue;
            }
            const node = maybeMissingNode;
            const activeRevision = (0, nodeUtils_1.getActiveRevision)(node);
            const childNode = {
                uid: node.ok ? node.value.uid : node.error.uid,
                name: (0, nodeUtils_1.getNodeName)(node),
                type: (0, nodeUtils_1.getNodeType)(node),
                claimedSha1: activeRevision?.claimedDigests?.sha1,
                claimedSizeInBytes: activeRevision?.claimedSize,
            };
            if (!node.ok) {
                childNode.error = node.error || 'degraded node';
            }
            children.push(childNode);
        }
        treeNode.children = children;
        return treeNode;
    }
}
exports.SDKDiagnosticPhotos = SDKDiagnosticPhotos;
//# sourceMappingURL=sdkDiagnosticPhotos.js.map