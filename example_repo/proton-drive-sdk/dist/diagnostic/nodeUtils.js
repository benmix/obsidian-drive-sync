"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeDetails = getNodeDetails;
exports.getNodeUids = getNodeUids;
exports.getNodeType = getNodeType;
exports.getMediaType = getMediaType;
exports.getActiveRevision = getActiveRevision;
exports.getNodeName = getNodeName;
exports.getExpectedTreeNodeDetails = getExpectedTreeNodeDetails;
exports.getTreeNodeChildByNodeName = getTreeNodeChildByNodeName;
function getNodeDetails(node) {
    const errors = [];
    if (!node.ok) {
        const degradedNode = node.error;
        if (!degradedNode.name.ok) {
            errors.push({
                field: 'name',
                error: degradedNode.name.error,
            });
        }
        if (degradedNode.activeRevision?.ok === false) {
            errors.push({
                field: 'activeRevision',
                error: degradedNode.activeRevision.error,
            });
        }
        for (const error of degradedNode.errors ?? []) {
            if (error instanceof Error) {
                errors.push({
                    field: 'error',
                    error,
                });
            }
        }
    }
    return {
        safeNodeDetails: {
            ...getNodeUids(node),
            nodeType: getNodeType(node),
            mediaType: getMediaType(node),
            nodeCreationTime: node.ok ? node.value.creationTime : node.error.creationTime,
            keyAuthor: node.ok ? node.value.keyAuthor : node.error.keyAuthor,
            nameAuthor: node.ok ? node.value.nameAuthor : node.error.nameAuthor,
            contentAuthor: getActiveRevision(node)?.contentAuthor,
            errors,
        },
        sensitiveNodeDetails: node,
    };
}
function getNodeUids(node) {
    const activeRevision = getActiveRevision(node);
    return {
        nodeUid: node.ok ? node.value.uid : node.error.uid,
        revisionUid: activeRevision?.uid,
    };
}
function getNodeType(node) {
    return node.ok ? node.value.type : node.error.type;
}
function getMediaType(node) {
    return node.ok ? node.value.mediaType : node.error.mediaType;
}
function getActiveRevision(node) {
    if (node.ok) {
        return node.value.activeRevision;
    }
    if (node.error.activeRevision?.ok) {
        return node.error.activeRevision.value;
    }
    return undefined;
}
function getNodeName(node) {
    if (node.ok) {
        return node.value.name;
    }
    if (node.error.name.ok) {
        return node.error.name.value;
    }
    return 'N/A';
}
function getExpectedTreeNodeDetails(expectedNode) {
    return {
        ...expectedNode,
        children: undefined,
    };
}
function getTreeNodeChildByNodeName(expectedSubtree, nodeName) {
    return expectedSubtree?.children?.find((expectedNode) => expectedNode.name === nodeName);
}
//# sourceMappingURL=nodeUtils.js.map