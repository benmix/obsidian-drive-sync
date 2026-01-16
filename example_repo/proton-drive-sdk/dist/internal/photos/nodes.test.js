"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = require("../../cache");
const interface_1 = require("../../interface");
const logger_1 = require("../../tests/logger");
const telemetry_1 = require("../../tests/telemetry");
const nodes_1 = require("./nodes");
function generateAPINode() {
    return {
        Link: {
            LinkID: 'linkId',
            ParentLinkID: 'parentLinkId',
            NameHash: 'nameHash',
            CreateTime: 123456789,
            ModifyTime: 1234567890,
            TrashTime: 0,
            Name: 'encName',
            SignatureEmail: 'sigEmail',
            NameSignatureEmail: 'nameSigEmail',
            NodeKey: 'nodeKey',
            NodePassphrase: 'nodePass',
            NodePassphraseSignature: 'nodePassSig',
        },
        SharingSummary: null,
        Sharing: null,
        Membership: null,
    };
}
function generateAPIFolderNode(linkOverrides = {}, overrides = {}) {
    const node = generateAPINode();
    return {
        ...node,
        Link: { ...node.Link, Type: 1, ...linkOverrides },
        Folder: { XAttr: '{folder}', NodeHashKey: 'nodeHashKey' },
        Photo: null,
        ...overrides,
    };
}
function generateAPIAlbumNode(linkOverrides = {}, overrides = {}) {
    const node = generateAPINode();
    return {
        ...node,
        Link: { ...node.Link, Type: 3, ...linkOverrides },
        Photo: null,
        Folder: null,
        ...overrides,
    };
}
function generateAPIPhotoNode(linkOverrides = {}, overrides = {}) {
    const node = generateAPINode();
    return {
        ...node,
        Link: { ...node.Link, Type: 2, ...linkOverrides },
        Photo: {
            CaptureTime: 1700000000,
            MainPhotoLinkID: null,
            RelatedPhotosLinkIDs: [],
            ContentHash: 'contentHash123',
            Tags: [1, 2],
            Albums: [
                {
                    AlbumLinkID: 'albumLinkId1',
                    AddedTime: 1700001000,
                    Hash: 'albumHash',
                    ContentHash: 'albumContentHash',
                },
            ],
            ActiveRevision: {
                RevisionID: 'revisionId',
                CreateTime: 1234567890,
                SignatureEmail: 'revSigEmail',
                XAttr: '{photo}',
                EncryptedSize: 12,
            },
            MediaType: 'image/jpeg',
            ContentKeyPacket: 'contentKeyPacket',
            ContentKeyPacketSignature: 'contentKeyPacketSig',
        },
        Folder: null,
        ...overrides,
    };
}
describe('PhotosNodesAPIService', () => {
    let apiMock;
    let api;
    beforeEach(() => {
        // @ts-expect-error Mocking for testing purposes
        apiMock = {
            post: jest.fn(),
        };
        api = new nodes_1.PhotosNodesAPIService((0, logger_1.getMockLogger)(), apiMock, 'clientUid');
    });
    describe('linkToEncryptedNode', () => {
        async function testIterateNodes(mockedLink, expectedType) {
            apiMock.post = jest.fn().mockResolvedValue({ Links: [mockedLink] });
            const nodes = await Array.fromAsync(api.iterateNodes(['volumeId~nodeId'], 'volumeId'));
            expect(nodes).toHaveLength(1);
            expect(nodes[0].type).toBe(expectedType);
        }
        it('should convert folder (type 1) to folder node', async () => {
            await testIterateNodes(generateAPIFolderNode(), interface_1.NodeType.Folder);
        });
        it('should convert album (type 3) to album node', async () => {
            await testIterateNodes(generateAPIAlbumNode(), interface_1.NodeType.Album);
        });
        it('should convert photo (type 2) to photo node with photo attributes', async () => {
            apiMock.post = jest.fn().mockResolvedValue({ Links: [generateAPIPhotoNode()] });
            const nodes = await Array.fromAsync(api.iterateNodes(['volumeId~nodeId'], 'volumeId'));
            expect(nodes).toHaveLength(1);
            expect(nodes[0].type).toBe(interface_1.NodeType.Photo);
            expect(nodes[0].photo).toBeDefined();
            expect(nodes[0].photo?.captureTime).toEqual(new Date(1700000000 * 1000));
            expect(nodes[0].photo?.tags).toEqual([1, 2]);
            expect(nodes[0].photo?.albums).toHaveLength(1);
            expect(nodes[0].photo?.albums[0].nodeUid).toBe('volumeId~albumLinkId1');
            expect(nodes[0].photo?.albums[0].additionTime).toEqual(new Date(1700001000 * 1000));
        });
    });
});
describe('PhotosNodesCache', () => {
    let cache;
    beforeEach(() => {
        const memoryCache = new cache_1.MemoryCache();
        cache = new nodes_1.PhotosNodesCache((0, logger_1.getMockLogger)(), memoryCache);
    });
    describe('deserialiseNode', () => {
        it('should convert photo attributes dates from strings to Date objects', () => {
            const serialisedNode = JSON.stringify({
                uid: 'volumeId~linkId',
                parentUid: 'volumeId~parentLinkId',
                type: interface_1.NodeType.Photo,
                directRole: interface_1.MemberRole.Admin,
                isShared: false,
                isSharedPublicly: false,
                creationTime: '2023-11-14T22:13:20.000Z',
                modificationTime: '2023-11-14T22:13:20.000Z',
                photo: {
                    captureTime: '2023-11-14T22:13:20.000Z',
                    mainPhotoNodeUid: undefined,
                    relatedPhotoNodeUids: [],
                    tags: [1],
                    albums: [
                        {
                            nodeUid: 'volumeId~albumId',
                            additionTime: '2023-11-15T10:00:00.000Z',
                        },
                    ],
                },
            });
            const node = cache.deserialiseNode(serialisedNode);
            expect(node.photo).toBeDefined();
            expect(node.photo?.captureTime).toBeInstanceOf(Date);
            expect(node.photo?.captureTime).toEqual(new Date('2023-11-14T22:13:20.000Z'));
            expect(node.photo?.albums[0].additionTime).toBeInstanceOf(Date);
            expect(node.photo?.albums[0].additionTime).toEqual(new Date('2023-11-15T10:00:00.000Z'));
        });
        it('should handle node without photo attributes', () => {
            const serialisedNode = JSON.stringify({
                uid: 'volumeId~linkId',
                parentUid: 'volumeId~parentLinkId',
                type: interface_1.NodeType.Folder,
                directRole: interface_1.MemberRole.Admin,
                isShared: false,
                isSharedPublicly: false,
                creationTime: '2023-11-14T22:13:20.000Z',
                modificationTime: '2023-11-14T22:13:20.000Z',
            });
            const node = cache.deserialiseNode(serialisedNode);
            expect(node.photo).toBeUndefined();
        });
    });
});
describe('PhotosNodesAccess', () => {
    describe('parseNode', () => {
        it('should keep photo type and add photo object', async () => {
            const telemetry = (0, telemetry_1.getMockTelemetry)();
            // @ts-expect-error Mocking for testing purposes
            const cryptoService = {};
            // @ts-expect-error Mocking for testing purposes
            const apiService = {};
            // @ts-expect-error Mocking for testing purposes
            const cacheService = {};
            // @ts-expect-error Mocking for testing purposes
            const cryptoCache = {};
            // @ts-expect-error Mocking for testing purposes
            const sharesService = {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nodesAccess = new nodes_1.PhotosNodesAccess(telemetry, apiService, cacheService, cryptoCache, cryptoService, sharesService);
            const unparsedNode = {
                uid: 'volumeId~linkId',
                parentUid: 'volumeId~parentLinkId',
                type: interface_1.NodeType.Photo,
                name: 'photo.jpg',
                hash: 'hash123',
                directRole: interface_1.MemberRole.Admin,
                isShared: false,
                isSharedPublicly: false,
                creationTime: new Date(),
                modificationTime: new Date(),
                trashTime: undefined,
                mediaType: 'image/jpeg',
                folder: undefined,
                file: {
                    activeRevision: {
                        uid: 'revisionId',
                        state: 'active',
                        creationTime: new Date(),
                        storageSize: 100,
                        signatureEmail: 'test@example.com',
                        claimedModificationTime: new Date(),
                        claimedSize: 100,
                        claimedDigests: { sha1: 'sha1hash' },
                        claimedBlockSizes: [100],
                    },
                },
                photo: {
                    captureTime: new Date('2023-11-14T22:13:20.000Z'),
                    mainPhotoNodeUid: undefined,
                    relatedPhotoNodeUids: [],
                    tags: [1, 2],
                    albums: [],
                },
            };
            // @ts-expect-error Accessing protected method for testing
            const parsedNode = nodesAccess.parseNode(unparsedNode);
            expect(parsedNode.type).toBe(interface_1.NodeType.Photo);
            expect(parsedNode.photo).toBeDefined();
            expect(parsedNode.photo?.captureTime).toEqual(new Date('2023-11-14T22:13:20.000Z'));
            expect(parsedNode.photo?.tags).toEqual([1, 2]);
        });
    });
});
//# sourceMappingURL=nodes.test.js.map