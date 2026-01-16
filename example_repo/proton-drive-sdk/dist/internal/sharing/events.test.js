"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../tests/logger");
const events_1 = require("../events");
const events_2 = require("./events");
// FIXME: test tree_refresh and tree_remove
describe('handleSharedByMeNodes', () => {
    let cache;
    let sharingEventHandler;
    let sharesManager;
    beforeEach(() => {
        jest.clearAllMocks();
        // @ts-expect-error No need to implement all methods for mocking
        cache = {
            addSharedByMeNodeUid: jest.fn(),
            removeSharedByMeNodeUid: jest.fn(),
            setSharedWithMeNodeUids: jest.fn(),
            getSharedByMeNodeUids: jest.fn().mockResolvedValue(['cachedNodeUid']),
            hasSharedByMeNodeUidsLoaded: jest.fn().mockResolvedValue(true),
        };
        sharesManager = {
            isOwnVolume: jest.fn(async (volumeId) => volumeId === 'MyVolume1'),
        };
        sharingEventHandler = new events_2.SharingEventHandler((0, logger_1.getMockLogger)(), cache, sharesManager);
    });
    it('should add if new own shared node is created', async () => {
        const event = {
            eventId: '1',
            type: events_1.DriveEventType.NodeCreated,
            nodeUid: 'newNodeUid',
            parentNodeUid: 'parentUid',
            isTrashed: false,
            isShared: true,
            treeEventScopeId: 'MyVolume1',
        };
        await sharingEventHandler.handleDriveEvent(event);
        expect(cache.addSharedByMeNodeUid).toHaveBeenCalledWith('newNodeUid');
        expect(cache.setSharedWithMeNodeUids).not.toHaveBeenCalled();
    });
    test('should not add if new shared node is not own', async () => {
        const event = {
            eventId: '1',
            type: events_1.DriveEventType.NodeCreated,
            nodeUid: 'newNodeUid',
            parentNodeUid: 'parentUid',
            isTrashed: false,
            isShared: true,
            treeEventScopeId: 'NotOwnVolume',
        };
        await sharingEventHandler.handleDriveEvent(event);
        expect(cache.addSharedByMeNodeUid).not.toHaveBeenCalled();
        expect(cache.setSharedWithMeNodeUids).not.toHaveBeenCalled();
    });
    it('should not add if new own node is not shared', async () => {
        const event = {
            type: events_1.DriveEventType.NodeCreated,
            nodeUid: 'newNodeUid',
            parentNodeUid: 'parentUid',
            isTrashed: false,
            isShared: false,
            eventId: '1',
            treeEventScopeId: 'MyVolume1',
        };
        await sharingEventHandler.handleDriveEvent(event);
        expect(cache.addSharedByMeNodeUid).not.toHaveBeenCalled();
        expect(cache.setSharedWithMeNodeUids).not.toHaveBeenCalled();
    });
    it('should add if own node is updated and shared', async () => {
        const event = {
            type: events_1.DriveEventType.NodeUpdated,
            nodeUid: 'cachedNodeUid',
            parentNodeUid: 'parentUid',
            isTrashed: false,
            isShared: true,
            eventId: '1',
            treeEventScopeId: 'MyVolume1',
        };
        await sharingEventHandler.handleDriveEvent(event);
        expect(cache.addSharedByMeNodeUid).toHaveBeenCalledWith('cachedNodeUid');
        expect(cache.setSharedWithMeNodeUids).not.toHaveBeenCalled();
    });
    it('should remove if shared node is un-shared', async () => {
        const event = {
            type: events_1.DriveEventType.NodeUpdated,
            nodeUid: 'cachedNodeUid',
            parentNodeUid: 'parentUid',
            isTrashed: false,
            isShared: false,
            eventId: '1',
            treeEventScopeId: 'MyVolume1',
        };
        await sharingEventHandler.handleDriveEvent(event);
        expect(cache.removeSharedByMeNodeUid).toHaveBeenCalledWith('cachedNodeUid');
        expect(cache.setSharedWithMeNodeUids).not.toHaveBeenCalled();
    });
    it('should remove if shared node is deleted', async () => {
        const event = {
            type: events_1.DriveEventType.NodeDeleted,
            nodeUid: 'cachedNodeUid',
            parentNodeUid: 'parentUid',
            eventId: '1',
            treeEventScopeId: 'MyVolume1',
        };
        await sharingEventHandler.handleDriveEvent(event);
        expect(cache.removeSharedByMeNodeUid).toHaveBeenCalledWith('cachedNodeUid');
        expect(cache.setSharedWithMeNodeUids).not.toHaveBeenCalled();
    });
    it('should not update cache if shared by me is not loaded', async () => {
        cache.hasSharedByMeNodeUidsLoaded = jest.fn().mockResolvedValue(false);
        const event = {
            eventId: '1',
            type: events_1.DriveEventType.NodeCreated,
            nodeUid: 'newNodeUid',
            parentNodeUid: 'parentUid',
            isTrashed: false,
            isShared: true,
            treeEventScopeId: 'MyVolume1',
        };
        await sharingEventHandler.handleDriveEvent(event);
        expect(cache.addSharedByMeNodeUid).not.toHaveBeenCalled();
        expect(cache.setSharedWithMeNodeUids).not.toHaveBeenCalled();
    });
});
describe('handleSharedWithMeNodes', () => {
    let cache;
    let sharingAccess;
    let sharesManager;
    beforeEach(() => {
        jest.clearAllMocks();
        // @ts-expect-error No need to implement all methods for mocking
        cache = {
            getSharedWithMeNodeUids: jest.fn(),
            setSharedWithMeNodeUids: jest.fn(),
        };
        // @ts-expect-error No need to implement all methods for mocking
        sharingAccess = {
            iterateSharedNodesWithMe: jest.fn(),
        };
        sharesManager = {
            isOwnVolume: jest.fn(async (volumeId) => volumeId === 'MyVolume1'),
        };
    });
    it('should update cache', async () => {
        const event = {
            type: events_1.DriveEventType.SharedWithMeUpdated,
            eventId: 'event1',
            treeEventScopeId: 'core',
        };
        const sharingEventHandler = new events_2.SharingEventHandler((0, logger_1.getMockLogger)(), cache, sharesManager);
        await sharingEventHandler.handleDriveEvent(event);
        expect(cache.setSharedWithMeNodeUids).toHaveBeenCalledWith(undefined);
        expect(cache.getSharedWithMeNodeUids).not.toHaveBeenCalled();
        expect(sharingAccess.iterateSharedNodesWithMe).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=events.test.js.map