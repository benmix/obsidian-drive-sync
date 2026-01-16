"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interface_1 = require("../../interface");
const errors_1 = require("../../errors");
const sharingAccess_1 = require("./sharingAccess");
describe('SharingAccess', () => {
    let apiService;
    let cache;
    let cryptoService;
    let sharesService;
    let nodesService;
    let sharingAccess;
    const nodeUids = Array.from({ length: sharingAccess_1.BATCH_LOADING_SIZE + 5 }, (_, i) => `volumeId~nodeUid${i}`);
    const nodes = nodeUids.map((nodeUid) => ({
        nodeUid,
        shareId: 'shareId',
        name: { ok: true, value: `name${nodeUid.split('~')[1]}` }
    }));
    const nodeUidsIterator = async function* () {
        for (const nodeUid of nodeUids) {
            yield nodeUid;
        }
    };
    beforeEach(() => {
        // @ts-expect-error No need to implement all methods for mocking
        apiService = {
            iterateSharedNodeUids: jest.fn().mockImplementation(() => nodeUidsIterator()),
            iterateSharedWithMeNodeUids: jest.fn().mockImplementation(() => nodeUidsIterator()),
            iterateBookmarks: jest.fn().mockImplementation(async function* () {
                yield {
                    tokenId: 'tokenId',
                    creationTime: new Date('2025-01-01'),
                    node: {
                        type: interface_1.NodeType.File,
                        mediaType: 'image/jpeg',
                    },
                };
            }),
            removeMember: jest.fn(),
            iterateInvitationUids: jest.fn().mockImplementation(async function* () {
                yield 'invitationUid';
            }),
            getInvitation: jest.fn().mockResolvedValue({
                uid: 'invitationUid',
                node: { uid: 'volumeId~nodeUid' },
                inviteeEmail: 'invitee-email',
                role: interface_1.MemberRole.Viewer,
            }),
            acceptInvitation: jest.fn(),
            rejectInvitation: jest.fn(),
            deleteBookmark: jest.fn(),
        };
        // @ts-expect-error No need to implement all methods for mocking
        cache = {
            setSharedByMeNodeUids: jest.fn(),
            setSharedWithMeNodeUids: jest.fn(),
            getSharedByMeNodeUids: jest.fn(),
            getSharedWithMeNodeUids: jest.fn(),
            hasSharedByMeNodeUidsLoaded: jest.fn().mockResolvedValue(true),
            hasSharedWithMeNodeUidsLoaded: jest.fn().mockResolvedValue(true),
            addSharedByMeNodeUid: jest.fn(),
            removeSharedByMeNodeUid: jest.fn(),
            addSharedWithMeNodeUid: jest.fn(),
            removeSharedWithMeNodeUid: jest.fn(),
        };
        // @ts-expect-error No need to implement all methods for mocking
        cryptoService = {
            decryptInvitation: jest.fn(),
            decryptBookmark: jest.fn(),
            decryptInvitationWithNode: jest.fn().mockResolvedValue({
                uid: 'invitationUid',
                inviteeEmail: 'invitee-email',
                role: interface_1.MemberRole.Viewer,
                node: {
                    uid: 'volumeId~nodeUid',
                    name: { ok: true, value: 'SharedFile.txt' },
                    type: interface_1.NodeType.File,
                },
            }),
            acceptInvitation: jest.fn().mockResolvedValue({
                base64SessionKeySignature: 'mockSignature',
            }),
        };
        // @ts-expect-error No need to implement all methods for mocking
        sharesService = {
            getRootIDs: jest.fn().mockResolvedValue({ volumeId: 'volumeId' }),
            loadEncryptedShare: jest.fn().mockResolvedValue({
                id: 'shareId',
                membership: { memberUid: 'memberUid' },
            }),
        };
        // @ts-expect-error No need to implement all methods for mocking
        nodesService = {
            iterateNodes: jest.fn().mockImplementation(async function* (nodeUids) {
                for (const node of nodes) {
                    if (nodeUids.includes(node.nodeUid)) {
                        yield node;
                    }
                }
            }),
            getNode: jest.fn().mockResolvedValue({
                nodeUid: 'volumeId~nodeUid',
                shareId: 'shareId',
                name: { ok: true, value: 'TestFile.txt' },
            }),
        };
        sharingAccess = new sharingAccess_1.SharingAccess(apiService, cache, cryptoService, sharesService, nodesService);
    });
    describe('iterateSharedNodes', () => {
        it('should iterate from cache when available', async () => {
            cache.getSharedByMeNodeUids = jest.fn().mockResolvedValue(nodeUids);
            const result = await Array.fromAsync(sharingAccess.iterateSharedNodes());
            expect(result).toEqual(nodes);
            expect(apiService.iterateSharedNodeUids).not.toHaveBeenCalled();
            expect(cache.setSharedByMeNodeUids).not.toHaveBeenCalled();
        });
        it('should iterate from API when cache is empty', async () => {
            cache.getSharedByMeNodeUids = jest.fn().mockRejectedValue(new Error('Cache miss'));
            const result = await Array.fromAsync(sharingAccess.iterateSharedNodes());
            expect(result).toEqual(nodes);
            expect(apiService.iterateSharedNodeUids).toHaveBeenCalledWith('volumeId', undefined);
            expect(nodesService.iterateNodes).toHaveBeenCalledTimes(2);
            expect(cache.setSharedByMeNodeUids).toHaveBeenCalledWith(nodeUids);
        });
        it('should ignore missing nodes during iteration', async () => {
            cache.getSharedByMeNodeUids = jest.fn().mockResolvedValue(['volumeId~nodeUid1', 'volumeId~missingNode']);
            nodesService.iterateNodes = jest.fn().mockImplementation(async function* () {
                yield { nodeUid: 'volumeId~nodeUid1', name: { ok: true, value: 'file1.txt' } };
                yield { missingUid: 'volumeId~missingNode' };
            });
            const result = await Array.fromAsync(sharingAccess.iterateSharedNodes());
            expect(result).toEqual([{ nodeUid: 'volumeId~nodeUid1', name: { ok: true, value: 'file1.txt' } }]);
        });
    });
    describe('iterateSharedNodesWithMe', () => {
        it('should iterate from cache when available', async () => {
            cache.getSharedWithMeNodeUids = jest.fn().mockResolvedValue(nodeUids);
            const result = await Array.fromAsync(sharingAccess.iterateSharedNodesWithMe());
            expect(result).toEqual(nodes);
            expect(apiService.iterateSharedWithMeNodeUids).not.toHaveBeenCalled();
            expect(cache.setSharedWithMeNodeUids).not.toHaveBeenCalled();
        });
        it('should iterate from API when cache is empty', async () => {
            cache.getSharedWithMeNodeUids = jest.fn().mockRejectedValue(new Error('Cache miss'));
            const result = await Array.fromAsync(sharingAccess.iterateSharedNodesWithMe());
            expect(result).toEqual(nodes);
            expect(apiService.iterateSharedWithMeNodeUids).toHaveBeenCalledWith(undefined);
            expect(nodesService.iterateNodes).toHaveBeenCalledTimes(2);
            expect(cache.setSharedWithMeNodeUids).toHaveBeenCalledWith(nodeUids);
        });
    });
    describe('removeSharedNodeWithMe', () => {
        const nodeUid = 'volumeId~nodeUid';
        it('should remove member and update cache', async () => {
            await sharingAccess.removeSharedNodeWithMe(nodeUid);
            expect(nodesService.getNode).toHaveBeenCalledWith(nodeUid);
            expect(sharesService.loadEncryptedShare).toHaveBeenCalledWith('shareId');
            expect(apiService.removeMember).toHaveBeenCalledWith('memberUid');
            expect(cache.removeSharedWithMeNodeUid).toHaveBeenCalledWith(nodeUid);
        });
        it('should return early if node is not shared', async () => {
            nodesService.getNode = jest.fn().mockResolvedValue({
                nodeUid,
                shareId: undefined,
                name: { ok: true, value: 'UnsharedFile.txt' }
            });
            await sharingAccess.removeSharedNodeWithMe(nodeUid);
            expect(sharesService.loadEncryptedShare).not.toHaveBeenCalled();
            expect(apiService.removeMember).not.toHaveBeenCalled();
            expect(cache.removeSharedWithMeNodeUid).not.toHaveBeenCalled();
        });
        it('should throw ValidationError if no membership found', async () => {
            sharesService.loadEncryptedShare = jest.fn().mockResolvedValue({
                id: 'shareId',
                membership: undefined,
            });
            await expect(sharingAccess.removeSharedNodeWithMe(nodeUid)).rejects.toThrow(errors_1.ValidationError);
            expect(apiService.removeMember).not.toHaveBeenCalled();
            expect(cache.removeSharedWithMeNodeUid).not.toHaveBeenCalled();
        });
    });
    describe('iterateInvitations', () => {
        it('should iterate and decrypt invitations', async () => {
            const result = await Array.fromAsync(sharingAccess.iterateInvitations());
            expect(result).toEqual([{
                    uid: 'invitationUid',
                    inviteeEmail: 'invitee-email',
                    role: interface_1.MemberRole.Viewer,
                    node: {
                        uid: 'volumeId~nodeUid',
                        name: { ok: true, value: 'SharedFile.txt' },
                        type: interface_1.NodeType.File,
                    },
                }]);
            expect(apiService.iterateInvitationUids).toHaveBeenCalledWith(undefined);
            expect(apiService.getInvitation).toHaveBeenCalledWith('invitationUid');
            expect(cryptoService.decryptInvitationWithNode).toHaveBeenCalledWith({
                uid: 'invitationUid',
                node: { uid: 'volumeId~nodeUid' },
                inviteeEmail: 'invitee-email',
                role: interface_1.MemberRole.Viewer,
            });
        });
    });
    describe('acceptInvitation', () => {
        it('should accept invitation and update cache', async () => {
            const invitationUid = 'invitationUid';
            await sharingAccess.acceptInvitation(invitationUid);
            expect(apiService.getInvitation).toHaveBeenCalledWith(invitationUid);
            expect(cryptoService.acceptInvitation).toHaveBeenCalledWith({
                uid: 'invitationUid',
                node: { uid: 'volumeId~nodeUid' },
                inviteeEmail: 'invitee-email',
                role: interface_1.MemberRole.Viewer,
            });
            expect(apiService.acceptInvitation).toHaveBeenCalledWith(invitationUid, 'mockSignature');
            expect(cache.addSharedWithMeNodeUid).toHaveBeenCalledWith('volumeId~nodeUid');
        });
        it('should not update cache when not loaded', async () => {
            const invitationUid = 'invitationUid';
            cache.hasSharedWithMeNodeUidsLoaded = jest.fn().mockResolvedValue(false);
            await sharingAccess.acceptInvitation(invitationUid);
            expect(apiService.acceptInvitation).toHaveBeenCalledWith(invitationUid, 'mockSignature');
            expect(cache.addSharedWithMeNodeUid).not.toHaveBeenCalled();
        });
    });
    describe('rejectInvitation', () => {
        it('should reject invitation', async () => {
            const invitationUid = 'invitationUid';
            await sharingAccess.rejectInvitation(invitationUid);
            expect(apiService.rejectInvitation).toHaveBeenCalledWith(invitationUid);
        });
    });
    describe('iterateBookmarks', () => {
        it('should return successfully decrypted bookmark', async () => {
            cryptoService.decryptBookmark = jest.fn().mockResolvedValue({
                url: (0, interface_1.resultOk)('https://example.com/file.pdf'),
                customPassword: (0, interface_1.resultOk)('password123'),
                nodeName: (0, interface_1.resultOk)('ImportantDocument.pdf'),
            });
            const result = await Array.fromAsync(sharingAccess.iterateBookmarks());
            expect(result).toEqual([
                (0, interface_1.resultOk)({
                    uid: 'tokenId',
                    creationTime: new Date('2025-01-01'),
                    url: 'https://example.com/file.pdf',
                    customPassword: 'password123',
                    node: {
                        name: 'ImportantDocument.pdf',
                        type: interface_1.NodeType.File,
                        mediaType: 'image/jpeg',
                    },
                }),
            ]);
        });
        it('should return successfully decrypted bookmark with undefined password', async () => {
            cryptoService.decryptBookmark = jest.fn().mockResolvedValue({
                url: (0, interface_1.resultOk)('https://example.com/file.pdf'),
                customPassword: (0, interface_1.resultOk)(undefined),
                nodeName: (0, interface_1.resultOk)('PublicDocument.pdf'),
            });
            const result = await Array.fromAsync(sharingAccess.iterateBookmarks());
            expect(result).toEqual([
                (0, interface_1.resultOk)({
                    uid: 'tokenId',
                    creationTime: new Date('2025-01-01'),
                    url: 'https://example.com/file.pdf',
                    customPassword: undefined,
                    node: {
                        name: 'PublicDocument.pdf',
                        type: interface_1.NodeType.File,
                        mediaType: 'image/jpeg',
                    },
                }),
            ]);
        });
        it('should return degraded bookmark when URL cannot be decrypted', async () => {
            cryptoService.decryptBookmark = jest.fn().mockResolvedValue({
                url: (0, interface_1.resultError)('URL decryption failed'),
                customPassword: (0, interface_1.resultOk)('password123'),
                nodeName: (0, interface_1.resultOk)('Document.pdf'),
            });
            const result = await Array.fromAsync(sharingAccess.iterateBookmarks());
            expect(result).toEqual([
                (0, interface_1.resultError)({
                    uid: 'tokenId',
                    creationTime: new Date('2025-01-01'),
                    url: (0, interface_1.resultError)('URL decryption failed'),
                    customPassword: (0, interface_1.resultOk)('password123'),
                    node: {
                        name: (0, interface_1.resultOk)('Document.pdf'),
                        type: interface_1.NodeType.File,
                        mediaType: 'image/jpeg',
                    },
                }),
            ]);
        });
        it('should return degraded bookmark when custom password cannot be decrypted', async () => {
            cryptoService.decryptBookmark = jest.fn().mockResolvedValue({
                url: (0, interface_1.resultOk)('https://example.com/file.pdf'),
                customPassword: (0, interface_1.resultError)('Password decryption failed'),
                nodeName: (0, interface_1.resultOk)('Document.pdf'),
            });
            const result = await Array.fromAsync(sharingAccess.iterateBookmarks());
            expect(result).toEqual([
                (0, interface_1.resultError)({
                    uid: 'tokenId',
                    creationTime: new Date('2025-01-01'),
                    url: (0, interface_1.resultOk)('https://example.com/file.pdf'),
                    customPassword: (0, interface_1.resultError)('Password decryption failed'),
                    node: {
                        name: (0, interface_1.resultOk)('Document.pdf'),
                        type: interface_1.NodeType.File,
                        mediaType: 'image/jpeg',
                    },
                }),
            ]);
        });
        it('should return degraded bookmark when node name cannot be decrypted', async () => {
            cryptoService.decryptBookmark = jest.fn().mockResolvedValue({
                url: (0, interface_1.resultOk)('https://example.com/file.pdf'),
                customPassword: (0, interface_1.resultOk)(undefined),
                nodeName: (0, interface_1.resultError)('Node name decryption failed'),
            });
            const result = await Array.fromAsync(sharingAccess.iterateBookmarks());
            expect(result).toEqual([
                (0, interface_1.resultError)({
                    uid: 'tokenId',
                    creationTime: new Date('2025-01-01'),
                    url: (0, interface_1.resultOk)('https://example.com/file.pdf'),
                    customPassword: (0, interface_1.resultOk)(undefined),
                    node: {
                        name: (0, interface_1.resultError)('Node name decryption failed'),
                        type: interface_1.NodeType.File,
                        mediaType: 'image/jpeg',
                    },
                }),
            ]);
        });
        it('should return degraded bookmark when all decryption fails', async () => {
            cryptoService.decryptBookmark = jest.fn().mockResolvedValue({
                url: (0, interface_1.resultError)('URL decryption failed'),
                customPassword: (0, interface_1.resultError)('Password decryption failed'),
                nodeName: (0, interface_1.resultError)('Node name decryption failed'),
            });
            const result = await Array.fromAsync(sharingAccess.iterateBookmarks());
            expect(result).toEqual([
                (0, interface_1.resultError)({
                    uid: 'tokenId',
                    creationTime: new Date('2025-01-01'),
                    url: (0, interface_1.resultError)('URL decryption failed'),
                    customPassword: (0, interface_1.resultError)('Password decryption failed'),
                    node: {
                        name: (0, interface_1.resultError)('Node name decryption failed'),
                        type: interface_1.NodeType.File,
                        mediaType: 'image/jpeg',
                    },
                }),
            ]);
        });
    });
    describe('deleteBookmark', () => {
        it('should delete bookmark using tokenId', async () => {
            const bookmarkUid = 'tokenId123';
            await sharingAccess.deleteBookmark(bookmarkUid);
            expect(apiService.deleteBookmark).toHaveBeenCalledWith(bookmarkUid);
        });
    });
});
//# sourceMappingURL=sharingAccess.test.js.map