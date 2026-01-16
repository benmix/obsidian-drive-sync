"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUid = getUid;
exports.getUids = getUids;
exports.convertInternalNodeIterator = convertInternalNodeIterator;
exports.convertInternalMissingNodeIterator = convertInternalMissingNodeIterator;
exports.convertInternalNodePromise = convertInternalNodePromise;
exports.convertInternalNode = convertInternalNode;
exports.convertInternalPhotoNodeIterator = convertInternalPhotoNodeIterator;
exports.convertInternalMissingPhotoNodeIterator = convertInternalMissingPhotoNodeIterator;
exports.convertInternalPhotoNodePromise = convertInternalPhotoNodePromise;
exports.convertInternalPhotoNode = convertInternalPhotoNode;
exports.convertInternalRevisionIterator = convertInternalRevisionIterator;
const interface_1 = require("./interface");
function getUid(nodeUid) {
    if (typeof nodeUid === 'string') {
        return nodeUid;
    }
    // Directly passed NodeEntity or DegradedNode that has UID directly.
    if ('uid' in nodeUid) {
        return nodeUid.uid;
    }
    // MaybeNode that can be either NodeEntity or DegradedNode.
    if (nodeUid.ok) {
        return nodeUid.value.uid;
    }
    return nodeUid.error.uid;
}
function getUids(nodeUids) {
    return nodeUids.map(getUid);
}
async function* convertInternalNodeIterator(nodeIterator) {
    for await (const node of nodeIterator) {
        yield convertInternalNode(node);
    }
}
async function* convertInternalMissingNodeIterator(nodeIterator) {
    for await (const node of nodeIterator) {
        if ('missingUid' in node) {
            yield (0, interface_1.resultError)(node);
        }
        else {
            yield convertInternalNode(node);
        }
    }
}
async function convertInternalNodePromise(nodePromise) {
    const node = await nodePromise;
    return convertInternalNode(node);
}
function convertInternalNode(node) {
    const baseNodeMetadata = {
        uid: node.uid,
        parentUid: node.parentUid,
        keyAuthor: node.keyAuthor,
        nameAuthor: node.nameAuthor,
        directRole: node.directRole,
        membership: node.membership,
        type: node.type,
        mediaType: node.mediaType,
        isShared: node.isShared,
        isSharedPublicly: node.isSharedPublicly,
        creationTime: node.creationTime,
        modificationTime: node.modificationTime,
        trashTime: node.trashTime,
        totalStorageSize: node.totalStorageSize,
        folder: node.folder,
        deprecatedShareId: node.shareId,
        treeEventScopeId: node.treeEventScopeId,
    };
    const name = node.name;
    const activeRevision = node.activeRevision;
    if (node.errors?.length || !name.ok || (activeRevision && !activeRevision.ok)) {
        return (0, interface_1.resultError)({
            ...baseNodeMetadata,
            name,
            activeRevision: activeRevision?.ok
                ? (0, interface_1.resultOk)(convertInternalRevision(activeRevision.value))
                : activeRevision,
            errors: node.errors,
        });
    }
    return (0, interface_1.resultOk)({
        ...baseNodeMetadata,
        name: name.value,
        activeRevision: activeRevision?.ok ? convertInternalRevision(activeRevision.value) : undefined,
    });
}
async function* convertInternalPhotoNodeIterator(photoNodeIterator) {
    for await (const photoNode of photoNodeIterator) {
        yield convertInternalPhotoNode(photoNode);
    }
}
async function* convertInternalMissingPhotoNodeIterator(photoNodeIterator) {
    for await (const photoNode of photoNodeIterator) {
        if ('missingUid' in photoNode) {
            yield (0, interface_1.resultError)(photoNode);
        }
        else {
            yield convertInternalPhotoNode(photoNode);
        }
    }
}
async function convertInternalPhotoNodePromise(photoNodePromise) {
    const photoNode = await photoNodePromise;
    return convertInternalPhotoNode(photoNode);
}
function convertInternalPhotoNode(photoNode) {
    const node = convertInternalNode(photoNode);
    if (node.ok) {
        return (0, interface_1.resultOk)({
            ...node.value,
            photo: photoNode.photo,
        });
    }
    return (0, interface_1.resultError)({
        ...node.error,
        photo: photoNode.photo,
    });
}
async function* convertInternalRevisionIterator(revisionIterator) {
    for await (const revision of revisionIterator) {
        yield convertInternalRevision(revision);
    }
}
function convertInternalRevision(revision) {
    return {
        uid: revision.uid,
        state: revision.state,
        creationTime: revision.creationTime,
        contentAuthor: revision.contentAuthor,
        storageSize: revision.storageSize,
        claimedSize: revision.claimedSize,
        claimedModificationTime: revision.claimedModificationTime,
        claimedDigests: revision.claimedDigests,
        claimedAdditionalMetadata: revision.claimedAdditionalMetadata,
    };
}
//# sourceMappingURL=transformers.js.map