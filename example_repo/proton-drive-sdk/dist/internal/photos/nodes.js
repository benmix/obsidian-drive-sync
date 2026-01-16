"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotosNodesManagement = exports.PhotosNodesCryptoService = exports.PhotosNodesAccess = exports.PhotosNodesCache = exports.PhotosNodesAPIService = void 0;
const interface_1 = require("../../interface");
const apiService_1 = require("../nodes/apiService");
const cache_1 = require("../nodes/cache");
const cryptoService_1 = require("../nodes/cryptoService");
const nodesAccess_1 = require("../nodes/nodesAccess");
const nodesManagement_1 = require("../nodes/nodesManagement");
const uids_1 = require("../uids");
class PhotosNodesAPIService extends apiService_1.NodeAPIServiceBase {
    async fetchNodeMetadata(volumeId, linkIds, signal) {
        const response = await this.apiService.post(`drive/photos/volumes/${volumeId}/links`, {
            LinkIDs: linkIds,
        }, signal);
        return response.Links;
    }
    linkToEncryptedNode(volumeId, link, isOwnVolumeId) {
        const { baseNodeMetadata, baseCryptoNodeMetadata } = (0, apiService_1.linkToEncryptedNodeBaseMetadata)(this.logger, volumeId, link, isOwnVolumeId);
        if (link.Link.Type === 2 && link.Photo && link.Photo.ActiveRevision) {
            const node = (0, apiService_1.linkToEncryptedNode)(this.logger, volumeId, { ...link, File: link.Photo, Folder: null }, isOwnVolumeId);
            return {
                ...node,
                type: interface_1.NodeType.Photo,
                photo: {
                    captureTime: new Date(link.Photo.CaptureTime * 1000),
                    mainPhotoNodeUid: link.Photo.MainPhotoLinkID
                        ? (0, uids_1.makeNodeUid)(volumeId, link.Photo.MainPhotoLinkID)
                        : undefined,
                    relatedPhotoNodeUids: link.Photo.RelatedPhotosLinkIDs.map((relatedLinkId) => (0, uids_1.makeNodeUid)(volumeId, relatedLinkId)),
                    contentHash: link.Photo.ContentHash || undefined,
                    tags: link.Photo.Tags,
                    albums: link.Photo.Albums.map((album) => ({
                        nodeUid: (0, uids_1.makeNodeUid)(volumeId, album.AlbumLinkID),
                        additionTime: new Date(album.AddedTime * 1000),
                        nameHash: album.Hash,
                        contentHash: album.ContentHash,
                    })),
                },
            };
        }
        if (link.Link.Type === 3) {
            return {
                ...baseNodeMetadata,
                encryptedCrypto: {
                    ...baseCryptoNodeMetadata,
                },
            };
        }
        const baseLink = {
            Link: link.Link,
            Membership: link.Membership,
            Sharing: link.Sharing,
            // @ts-expect-error The photo link can have a folder type, but not always. If not set, it will use other paths.
            Folder: link.Folder,
            File: null, // The photo link metadata never returns a file type.
        };
        return (0, apiService_1.linkToEncryptedNode)(this.logger, volumeId, baseLink, isOwnVolumeId);
    }
}
exports.PhotosNodesAPIService = PhotosNodesAPIService;
class PhotosNodesCache extends cache_1.NodesCacheBase {
    serialiseNode(node) {
        return (0, cache_1.serialiseNode)(node);
    }
    // TODO: use better deserialisation with validation
    deserialiseNode(nodeData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = (0, cache_1.deserialiseNode)(nodeData);
        if (!node ||
            typeof node !== 'object' ||
            (typeof node.photo !== 'object' && node.photo !== undefined) ||
            (typeof node.photo?.captureTime !== 'string' && node.folder?.captureTime !== undefined) ||
            (typeof node.photo?.albums !== 'object' && node.photo?.albums !== undefined)) {
            throw new Error(`Invalid node data: ${nodeData}`);
        }
        return {
            ...node,
            photo: !node.photo
                ? undefined
                : {
                    captureTime: new Date(node.photo.captureTime),
                    mainPhotoNodeUid: node.photo.mainPhotoNodeUid,
                    relatedPhotoNodeUids: node.photo.relatedPhotoNodeUids,
                    contentHash: node.photo.contentHash,
                    tags: node.photo.tags,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    albums: node.photo.albums?.map((album) => ({
                        nodeUid: album.nodeUid,
                        additionTime: new Date(album.additionTime),
                    })),
                },
        };
    }
}
exports.PhotosNodesCache = PhotosNodesCache;
class PhotosNodesAccess extends nodesAccess_1.NodesAccessBase {
    async getParentKeys(node) {
        if (node.parentUid || node.shareId) {
            return super.getParentKeys(node);
        }
        if (node.photo?.albums.length) {
            // If photo is in multiple albums, we just need to get keys for one of them.
            // Prefer to find a cached key first.
            for (const album of node.photo.albums) {
                try {
                    const keys = await this.cryptoCache.getNodeKeys(album.nodeUid);
                    return {
                        key: keys.key,
                        hashKey: keys.hashKey,
                    };
                }
                catch {
                    // We ignore missing or invalid keys here, its just optimization.
                    // If it cannot be fixed, it will bubble up later when requesting
                    // the node keys for one of the albums.
                }
            }
            const albumNodeUid = node.photo.albums[0].nodeUid;
            return this.getNodeKeys(albumNodeUid);
        }
        // This is bug that should not happen.
        // API cannot provide node without parent or share or album.
        throw new Error('Node has neither parent node nor share nor album');
    }
    getDegradedUndecryptableNode(encryptedNode, error) {
        return this.getDegradedUndecryptableNodeBase(encryptedNode, error);
    }
    parseNode(unparsedNode) {
        if (unparsedNode.type === interface_1.NodeType.Photo) {
            const node = (0, nodesAccess_1.parseNode)(this.logger, {
                ...unparsedNode,
                type: interface_1.NodeType.File,
            });
            return {
                ...node,
                photo: unparsedNode.photo,
                type: interface_1.NodeType.Photo,
            };
        }
        return (0, nodesAccess_1.parseNode)(this.logger, unparsedNode);
    }
}
exports.PhotosNodesAccess = PhotosNodesAccess;
class PhotosNodesCryptoService extends cryptoService_1.NodesCryptoService {
    async decryptNode(encryptedNode, parentKey) {
        const decryptedNode = await super.decryptNode(encryptedNode, parentKey);
        if (decryptedNode.node.type === interface_1.NodeType.Photo) {
            return {
                node: {
                    ...decryptedNode.node,
                    photo: encryptedNode.photo,
                },
            };
        }
        return decryptedNode;
    }
}
exports.PhotosNodesCryptoService = PhotosNodesCryptoService;
class PhotosNodesManagement extends nodesManagement_1.NodesManagementBase {
    generateNodeFolder(nodeUid, parentNodeUid, name, encryptedCrypto) {
        return this.generateNodeFolderBase(nodeUid, parentNodeUid, name, encryptedCrypto);
    }
}
exports.PhotosNodesManagement = PhotosNodesManagement;
//# sourceMappingURL=nodes.js.map