"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = require("../../cache");
const interface_1 = require("../../interface");
const logger_1 = require("../../tests/logger");
const cache_2 = require("./cache");
function generateNode(uid, parentUid = 'root', params = {}) {
    return {
        uid: `${params.volumeId || 'volumeId'}~:${uid}`,
        parentUid: `${params.volumeId || 'volumeId'}~:${parentUid}`,
        directRole: interface_1.MemberRole.Admin,
        membership: {
            role: interface_1.MemberRole.Admin,
            inviteTime: new Date(),
            sharedBy: (0, interface_1.resultOk)('test@example.com'),
        },
        type: interface_1.NodeType.File,
        mediaType: 'text',
        isShared: false,
        isSharedPublicly: false,
        creationTime: new Date(),
        modificationTime: new Date(),
        trashTime: undefined,
        volumeId: 'volumeId',
        isStale: false,
        activeRevision: undefined,
        folder: undefined,
        ...params,
    };
}
async function generateTreeStructure(cache) {
    for (const node of [
        generateNode('node1', 'root'),
        generateNode('node1a', 'node1'),
        generateNode('node1b', 'node1', { trashTime: new Date() }),
        generateNode('node1c', 'node1'),
        generateNode('node1c-alpha', 'node1c'),
        generateNode('node1c-beta', 'node1c', { trashTime: new Date() }),
        generateNode('node2', 'root'),
        generateNode('node2a', 'node2'),
        generateNode('node2b', 'node2', { trashTime: new Date() }),
        generateNode('node3', 'root'),
        generateNode('root-otherVolume', '', { volumeId: 'volume2' }),
    ]) {
        await cache.setNode(node);
    }
}
async function verifyNodesCache(cache, expectedNodes, expectedMissingNodes) {
    for (const nodeUid of expectedNodes) {
        try {
            await cache.getNode(`volumeId~:${nodeUid}`);
        }
        catch (error) {
            throw new Error(`${nodeUid} should be in the cache: ${error}`);
        }
    }
    for (const nodeUid of expectedMissingNodes) {
        try {
            await cache.getNode(`volumeId~:${nodeUid}`);
            throw new Error(`${nodeUid} should not be in the cache`);
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Entity not found');
        }
    }
}
describe('nodesCache', () => {
    let memoryCache;
    let cache;
    beforeEach(async () => {
        memoryCache = new cache_1.MemoryCache();
        await memoryCache.setEntity('node-volumeId~:root', JSON.stringify(generateNode('root', '')));
        await memoryCache.setEntity('node-badObject', 'aaa', [`${cache_2.CACHE_TAG_KEYS.ParentUid}:root`]);
        cache = new cache_2.NodesCache((0, logger_1.getMockLogger)(), memoryCache);
    });
    it('should store and retrieve node', async () => {
        const node = generateNode('node1', '');
        await cache.setNode(node);
        const result = await cache.getNode(node.uid);
        expect(result).toStrictEqual(node);
    });
    it('should store and retrieve folder node', async () => {
        const node = generateNode('node1', '', {
            folder: {
                claimedModificationTime: new Date('2021-01-01'),
            },
        });
        await cache.setNode(node);
        const result = await cache.getNode(node.uid);
        expect(result).toStrictEqual({
            ...node,
            folder: {
                claimedModificationTime: new Date('2021-01-01'),
            },
        });
    });
    it('should store and retrieve node with active revision', async () => {
        const activeRevision = (0, interface_1.resultOk)({
            uid: 'revision1',
            state: interface_1.RevisionState.Active,
            creationTime: new Date('2021-01-01'),
            storageSize: 100,
            contentAuthor: (0, interface_1.resultOk)('test@test.com'),
            claimedModificationTime: new Date('2021-02-01'),
            claimedSize: 100,
            claimedDigests: {
                sha1: 'hash',
            },
            claimedBlockSizes: [100],
            claimedAdditionalMetadata: {
                media: { width: 100, height: 100 },
            },
        });
        const node = generateNode('node1', '', { activeRevision });
        await cache.setNode(node);
        const result = await cache.getNode(node.uid);
        expect(result).toStrictEqual({
            ...node,
            activeRevision,
        });
    });
    it('should store and retrieve node with active revision with no claimed data', async () => {
        const activeRevision = (0, interface_1.resultOk)({
            uid: 'revision1',
            state: interface_1.RevisionState.Active,
            creationTime: new Date('2021-01-01'),
            storageSize: 100,
            contentAuthor: (0, interface_1.resultOk)('test@test.com'),
            claimedModificationTime: undefined,
        });
        const node = generateNode('node1', '', { activeRevision });
        await cache.setNode(node);
        const result = await cache.getNode(node.uid);
        expect(result).toStrictEqual({
            ...node,
            activeRevision,
        });
    });
    it('should throw an error when retrieving a non-existing entity', async () => {
        try {
            await cache.getNode('nonExistingNodeUid');
            fail('Should have thrown an error');
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Entity not found');
        }
    });
    it('should throw an error when retrieving a corrupted node and remove the node from the cache', async () => {
        try {
            await cache.getNode('badObject');
            fail('Should have thrown an error');
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Failed to deserialise node: Unexpected token \'a\', \"aaa\" is not valid JSON');
        }
        try {
            await memoryCache.getEntity('nodes-badObject');
            fail('Should have thrown an error');
        }
        catch (error) {
            expect(`${error}`).toBe('Error: Entity not found');
        }
    });
    it('should remove node without children', async () => {
        await generateTreeStructure(cache);
        await cache.removeNodes(['volumeId~:node3']);
        await verifyNodesCache(cache, ['node1', 'node1a', 'node1b', 'node1c', 'node1c-alpha', 'node1c-beta', 'node2', 'node2a', 'node2b'], ['node3']);
    });
    it('should remove node and its children', async () => {
        await generateTreeStructure(cache);
        await cache.removeNodes(['volumeId~:node2']);
        await verifyNodesCache(cache, ['node1', 'node1a', 'node1b', 'node1c', 'node1c-alpha', 'node1c-beta', 'node3'], ['node2', 'node2a', 'node2b']);
    });
    it('should remove node and its children recursively', async () => {
        await generateTreeStructure(cache);
        await cache.removeNodes(['volumeId~:node1']);
        await verifyNodesCache(cache, ['node2', 'node2a', 'node2b', 'node3'], ['node1', 'node1a', 'node1b', 'node1c', 'node1c-alpha', 'node1c-beta']);
    });
    it('should iterate requested nodes', async () => {
        await generateTreeStructure(cache);
        const result = await Array.fromAsync(cache.iterateNodes(['volumeId~:node1', 'volumeId~:node2']));
        const nodeUids = result.map(({ uid }) => uid);
        expect(nodeUids).toStrictEqual(['volumeId~:node1', 'volumeId~:node2']);
    });
    it('should iterate children without trashed items', async () => {
        await generateTreeStructure(cache);
        const result = await Array.fromAsync(cache.iterateChildren('volumeId~:node1'));
        const nodeUids = result.map(({ uid }) => uid);
        expect(nodeUids).toStrictEqual(['volumeId~:node1a', 'volumeId~:node1c']);
    });
    it('should iterate children and silently remove a corrupted node', async () => {
        await generateTreeStructure(cache);
        // badObject has root as parent.
        const result = await Array.fromAsync(cache.iterateChildren('volumeId~:root'));
        const nodeUids = result.map(({ uid }) => uid);
        expect(nodeUids).toStrictEqual(['volumeId~:node1', 'volumeId~:node2', 'volumeId~:node3']);
        await verifyNodesCache(cache, [
            'root',
            'node1',
            'node1a',
            'node1b',
            'node1c',
            'node1c-alpha',
            'node1c-beta',
            'node2',
            'node2a',
            'node2b',
            'node3',
        ], ['badObject']);
    });
    it('should iterate trashed nodes', async () => {
        await generateTreeStructure(cache);
        const result = await Array.fromAsync(cache.iterateTrashedNodes());
        const nodeUids = result.map(({ uid }) => uid);
        expect(nodeUids).toStrictEqual(['volumeId~:node1b', 'volumeId~:node1c-beta', 'volumeId~:node2b']);
    });
    it('should set and unset children loaded state', async () => {
        expect(await cache.isFolderChildrenLoaded('volumeId~:node1')).toBe(false);
        await cache.setFolderChildrenLoaded('volumeId~:node1');
        expect(await cache.isFolderChildrenLoaded('volumeId~:node1')).toBe(true);
        await cache.resetFolderChildrenLoaded('volumeId~:node1');
        expect(await cache.isFolderChildrenLoaded('volumeId~:node1')).toBe(false);
    });
    it('should set nodes from the volume as stale', async () => {
        await generateTreeStructure(cache);
        await cache.setNodesStaleFromVolume('volumeId');
        const staleNodeUids = [
            'node1',
            'node1a',
            'node1b',
            'node1c',
            'node1c-alpha',
            'node1c-beta',
            'node2',
            'node2a',
            'node2b',
            'node3',
        ].map((uid) => `volumeId~:${uid}`);
        const result = await Array.fromAsync(cache.iterateNodes([...staleNodeUids, 'volume2~:root-otherVolume']));
        const got = result.map((item) => ({ uid: item.uid, isStale: item.ok ? item.node.isStale : item.error }));
        const expected = [
            ...staleNodeUids.map((uid) => ({ uid, isStale: true })),
            { uid: 'volume2~:root-otherVolume', isStale: false },
        ];
        expect(got).toEqual(expected);
    });
});
//# sourceMappingURL=cache.test.js.map