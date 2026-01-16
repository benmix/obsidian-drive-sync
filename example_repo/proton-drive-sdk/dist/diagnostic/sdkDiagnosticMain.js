"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKDiagnosticMain = void 0;
const interface_1 = require("../interface");
const zipGenerators_1 = require("./zipGenerators");
const nodeUtils_1 = require("./nodeUtils");
const sdkDiagnosticBase_1 = require("./sdkDiagnosticBase");
/**
 * Diagnostic tool that uses the main Drive SDK to traverse and verify
 * the integrity of the node tree.
 */
class SDKDiagnosticMain extends sdkDiagnosticBase_1.SDKDiagnosticBase {
    protonDriveClient;
    constructor(protonDriveClient, options, onProgress) {
        super(protonDriveClient, options, onProgress);
        this.protonDriveClient = protonDriveClient;
        this.protonDriveClient = protonDriveClient;
    }
    async *verifyMyFiles(expectedStructure) {
        let myFilesRootFolder;
        try {
            myFilesRootFolder = await this.protonDriveClient.getMyFilesRootFolder();
        }
        catch (error) {
            yield {
                type: 'fatal_error',
                message: `Error getting my files root folder`,
                error,
            };
            return;
        }
        yield* this.verifyNodeTree(myFilesRootFolder, expectedStructure);
    }
    async *verifyNodeTree(node, expectedStructure) {
        this.startProgress();
        this.nodesQueue.push({ node, expected: expectedStructure });
        this.loadedNodes++;
        yield* (0, zipGenerators_1.zipGenerators)(this.loadNodeTree(node, expectedStructure), this.verifyNodesQueue());
        this.finishProgress();
    }
    async *loadNodeTree(parentNode, expectedStructure) {
        const isFolder = (0, nodeUtils_1.getNodeType)(parentNode) === interface_1.NodeType.Folder;
        if (isFolder) {
            yield* this.loadNodeTreeRecursively(parentNode, expectedStructure);
        }
        this.allNodesLoaded = true;
    }
    async *loadNodeTreeRecursively(parentNode, expectedStructure) {
        const parentNodeUid = parentNode.ok ? parentNode.value.uid : parentNode.error.uid;
        const children = [];
        try {
            for await (const child of this.protonDriveClient.iterateFolderChildren(parentNode)) {
                children.push(child);
                this.nodesQueue.push({
                    node: child,
                    expected: (0, nodeUtils_1.getTreeNodeChildByNodeName)(expectedStructure, (0, nodeUtils_1.getNodeName)(child)),
                });
                this.loadedNodes++;
            }
        }
        catch (error) {
            yield {
                type: 'sdk_error',
                call: `iterateFolderChildren(${parentNodeUid})`,
                error,
            };
        }
        if (expectedStructure) {
            yield* this.verifyExpectedNodeChildren(parentNodeUid, children, expectedStructure);
        }
        for (const child of children) {
            if ((0, nodeUtils_1.getNodeType)(child) === interface_1.NodeType.Folder) {
                yield* this.loadNodeTreeRecursively(child, (0, nodeUtils_1.getTreeNodeChildByNodeName)(expectedStructure, (0, nodeUtils_1.getNodeName)(child)));
            }
        }
    }
    async getStructure(node) {
        const nodeType = (0, nodeUtils_1.getNodeType)(node);
        const treeNode = {
            uid: node.ok ? node.value.uid : node.error.uid,
            type: nodeType,
            name: (0, nodeUtils_1.getNodeName)(node),
        };
        if (!node.ok) {
            treeNode.error = node.error || 'degraded node';
        }
        if (nodeType === interface_1.NodeType.Folder) {
            const children = [];
            for await (const child of this.protonDriveClient.iterateFolderChildren(node)) {
                children.push(child);
            }
            treeNode.children = [];
            for (const child of children) {
                const childStructure = await this.getStructure(child);
                treeNode.children.push(childStructure);
            }
        }
        else if (nodeType === interface_1.NodeType.File) {
            const activeRevision = (0, nodeUtils_1.getActiveRevision)(node);
            treeNode.claimedSha1 = activeRevision?.claimedDigests?.sha1;
            treeNode.claimedSizeInBytes = activeRevision?.claimedSize;
        }
        return treeNode;
    }
}
exports.SDKDiagnosticMain = SDKDiagnosticMain;
//# sourceMappingURL=sdkDiagnosticMain.js.map