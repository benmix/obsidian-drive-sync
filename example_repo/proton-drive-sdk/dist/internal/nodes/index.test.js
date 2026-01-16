"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interface_1 = require("../../interface");
const cache_1 = require("../../cache");
const telemetry_1 = require("../../tests/telemetry");
const events_1 = require("../events");
const uids_1 = require("../uids");
const index_1 = require("./index");
const cache_2 = require("./cache");
const logger_1 = require("../../tests/logger");
function generateNode(uid, parentUid = 'volumeId~root', params = {}) {
    return {
        uid,
        parentUid,
        directRole: interface_1.MemberRole.Admin,
        type: interface_1.NodeType.File,
        mediaType: 'text',
        isShared: false,
        isSharedPublicly: false,
        creationTime: new Date(),
        modificationTime: new Date(),
        trashTime: undefined,
        isStale: false,
        ...params,
    };
}
describe('nodesModules integration tests', () => {
    let apiService;
    let driveEntitiesCache;
    let driveCryptoCache;
    let account;
    let driveCrypto;
    let sharesService;
    let nodesModule;
    let nodesCache;
    beforeEach(() => {
        // @ts-expect-error No need to implement all methods for mocking
        apiService = {};
        driveEntitiesCache = new cache_1.MemoryCache();
        driveCryptoCache = new cache_1.MemoryCache();
        // @ts-expect-error No need to implement all methods for mocking
        account = {};
        // @ts-expect-error No need to implement all methods for mocking
        driveCrypto = {};
        // @ts-expect-error No need to implement all methods for mocking
        sharesService = {
            getRootIDs: jest.fn().mockResolvedValue({ volumeId: 'volumeId' }),
        };
        nodesModule = (0, index_1.initNodesModule)((0, telemetry_1.getMockTelemetry)(), apiService, driveEntitiesCache, driveCryptoCache, account, driveCrypto, sharesService, 'clientUid');
        nodesCache = new cache_2.NodesCache((0, logger_1.getMockLogger)(), driveEntitiesCache);
    });
    test('should move node from one folder to another after move event', async () => {
        // Prepare two folders (original and target) and a node in the original folder.
        const originalFolderUid = (0, uids_1.makeNodeUid)('volumeId', 'originalFolder');
        const targetFolderUid = (0, uids_1.makeNodeUid)('volumeId', 'targetFolder');
        const nodeUid = (0, uids_1.makeNodeUid)('volumeId', 'node1');
        await nodesCache.setNode(generateNode(originalFolderUid));
        await nodesCache.setFolderChildrenLoaded(originalFolderUid);
        await nodesCache.setNode(generateNode(targetFolderUid));
        await nodesCache.setFolderChildrenLoaded(targetFolderUid);
        await nodesCache.setNode(generateNode(nodeUid, originalFolderUid));
        // Mock the API services to return the moved node.
        // This is called when listing the children of the target folder after
        // move event (when node marked as stale).
        apiService.post = jest.fn().mockImplementation(async (url, body) => {
            expect(url).toBe(`drive/v2/volumes/volumeId/links`);
            return {
                Links: [
                    {
                        Link: {
                            LinkID: 'node1',
                            ParentLinkID: 'targetFolder',
                            NameHash: 'hash',
                            Type: 2,
                        },
                        File: {
                            ActiveRevision: {},
                        },
                    },
                ],
            };
        });
        jest.spyOn(nodesModule.access, 'getParentKeys').mockResolvedValue({ key: { _idx: 32131 } });
        // Verify the inital state before move event is sent.
        const originalBeforeMove = await Array.fromAsync(nodesModule.access.iterateFolderChildren(originalFolderUid));
        expect(originalBeforeMove).toMatchObject([{ uid: nodeUid, parentUid: originalFolderUid }]);
        const targetBeforeMove = await Array.fromAsync(nodesModule.access.iterateFolderChildren(targetFolderUid));
        expect(targetBeforeMove).toMatchObject([]);
        // Send the move event that updates the cache.
        await nodesModule.eventHandler.updateNodesCacheOnEvent({
            type: events_1.DriveEventType.NodeUpdated,
            nodeUid,
            parentNodeUid: targetFolderUid,
            isTrashed: false,
            isShared: false,
            treeEventScopeId: 'volumeId',
            eventId: '1',
        });
        // Verify the state after the move event, including when API service is called.
        const originalAfterMove = await Array.fromAsync(nodesModule.access.iterateFolderChildren(originalFolderUid));
        expect(originalAfterMove).toMatchObject([]);
        expect(apiService.post).not.toHaveBeenCalled();
        const targetAfterMove = await Array.fromAsync(nodesModule.access.iterateFolderChildren(targetFolderUid));
        expect(targetAfterMove).toMatchObject([{ uid: nodeUid, parentUid: targetFolderUid }]);
        expect(apiService.post).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=index.test.js.map