"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingAccess = exports.BATCH_LOADING_SIZE = void 0;
const ttag_1 = require("ttag");
const interface_1 = require("../../interface");
const errors_1 = require("../../errors");
const batchLoading_1 = require("../batchLoading");
// This is the number of nodes that are loaded in parallel.
// It is a trade-off between initial wait time and overhead of API calls.
exports.BATCH_LOADING_SIZE = 30;
/**
 * Provides high-level actions for access shared nodes.
 *
 * The manager is responsible for listing shared by me, shared with me,
 * invitations, bookmarks, etc., including API communication, encryption,
 * decryption, and caching.
 */
class SharingAccess {
    apiService;
    cache;
    cryptoService;
    sharesService;
    nodesService;
    constructor(apiService, cache, cryptoService, sharesService, nodesService) {
        this.apiService = apiService;
        this.cache = cache;
        this.cryptoService = cryptoService;
        this.sharesService = sharesService;
        this.nodesService = nodesService;
        this.apiService = apiService;
        this.cache = cache;
        this.cryptoService = cryptoService;
        this.sharesService = sharesService;
        this.nodesService = nodesService;
    }
    async *iterateSharedNodes(signal) {
        try {
            const nodeUids = await this.cache.getSharedByMeNodeUids();
            yield* this.iterateSharedNodesFromCache(nodeUids, signal);
        }
        catch {
            const { volumeId } = await this.sharesService.getRootIDs();
            const nodeUidsIterator = this.apiService.iterateSharedNodeUids(volumeId, signal);
            yield* this.iterateSharedNodesFromAPI(nodeUidsIterator, (nodeUids) => this.cache.setSharedByMeNodeUids(nodeUids), signal);
        }
    }
    async *iterateSharedNodesWithMe(signal) {
        try {
            const nodeUids = await this.cache.getSharedWithMeNodeUids();
            yield* this.iterateSharedNodesFromCache(nodeUids, signal);
        }
        catch {
            const nodeUidsIterator = this.apiService.iterateSharedWithMeNodeUids(signal);
            yield* this.iterateSharedNodesFromAPI(nodeUidsIterator, (nodeUids) => this.cache.setSharedWithMeNodeUids(nodeUids), signal);
        }
    }
    async *iterateSharedNodesFromCache(nodeUids, signal) {
        const batchLoading = new batchLoading_1.BatchLoading({
            iterateItems: (nodeUids) => this.iterateNodesAndIgnoreMissingOnes(nodeUids, signal),
            batchSize: exports.BATCH_LOADING_SIZE,
        });
        for (const nodeUid of nodeUids) {
            yield* batchLoading.load(nodeUid);
        }
        yield* batchLoading.loadRest();
    }
    async *iterateSharedNodesFromAPI(nodeUidsIterator, setCache, signal) {
        const loadedNodeUids = [];
        const batchLoading = new batchLoading_1.BatchLoading({
            iterateItems: (nodeUids) => this.iterateNodesAndIgnoreMissingOnes(nodeUids, signal),
            batchSize: exports.BATCH_LOADING_SIZE,
        });
        for await (const nodeUid of nodeUidsIterator) {
            loadedNodeUids.push(nodeUid);
            yield* batchLoading.load(nodeUid);
        }
        yield* batchLoading.loadRest();
        // Set cache only at the end. Once there is anything in the cache,
        // it will be used instead of requesting the data from the API.
        await setCache(loadedNodeUids);
    }
    async *iterateNodesAndIgnoreMissingOnes(nodeUids, signal) {
        const nodeGenerator = this.nodesService.iterateNodes(nodeUids, signal);
        for await (const node of nodeGenerator) {
            if ('missingUid' in node) {
                continue;
            }
            yield node;
        }
    }
    async removeSharedNodeWithMe(nodeUid) {
        const node = await this.nodesService.getNode(nodeUid);
        if (!node.shareId) {
            return;
        }
        const share = await this.sharesService.loadEncryptedShare(node.shareId);
        const memberUid = share.membership?.memberUid;
        if (!memberUid) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `You can leave only item that is shared with you`);
        }
        await this.apiService.removeMember(memberUid);
        if (await this.cache.hasSharedWithMeNodeUidsLoaded()) {
            await this.cache.removeSharedWithMeNodeUid(nodeUid);
        }
    }
    async *iterateInvitations(signal) {
        for await (const invitationUid of this.apiService.iterateInvitationUids(signal)) {
            const encryptedInvitation = await this.apiService.getInvitation(invitationUid);
            const invitation = await this.cryptoService.decryptInvitationWithNode(encryptedInvitation);
            yield invitation;
        }
    }
    async acceptInvitation(invitationUid) {
        const encryptedInvitation = await this.apiService.getInvitation(invitationUid);
        const { base64SessionKeySignature } = await this.cryptoService.acceptInvitation(encryptedInvitation);
        await this.apiService.acceptInvitation(invitationUid, base64SessionKeySignature);
        if (await this.cache.hasSharedWithMeNodeUidsLoaded()) {
            await this.cache.addSharedWithMeNodeUid(encryptedInvitation.node.uid);
        }
    }
    async rejectInvitation(invitationUid) {
        await this.apiService.rejectInvitation(invitationUid);
    }
    async *iterateBookmarks(signal) {
        for await (const bookmark of this.apiService.iterateBookmarks(signal)) {
            const { url, customPassword, nodeName } = await this.cryptoService.decryptBookmark(bookmark);
            if (!url.ok || !customPassword.ok || !nodeName.ok) {
                yield (0, interface_1.resultError)({
                    uid: bookmark.tokenId,
                    creationTime: bookmark.creationTime,
                    url: url,
                    customPassword,
                    node: {
                        name: nodeName,
                        type: bookmark.node.type,
                        mediaType: bookmark.node.mediaType,
                    },
                });
            }
            else {
                yield (0, interface_1.resultOk)({
                    uid: bookmark.tokenId,
                    creationTime: bookmark.creationTime,
                    url: url.value,
                    customPassword: customPassword.value,
                    node: {
                        name: nodeName.value,
                        type: bookmark.node.type,
                        mediaType: bookmark.node.mediaType,
                    },
                });
            }
        }
    }
    async deleteBookmark(bookmarkUid) {
        const tokenId = bookmarkUid;
        await this.apiService.deleteBookmark(tokenId);
    }
}
exports.SharingAccess = SharingAccess;
//# sourceMappingURL=sharingAccess.js.map