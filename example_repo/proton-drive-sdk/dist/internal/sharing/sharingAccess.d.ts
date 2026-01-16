import { MaybeBookmark, ProtonInvitationWithNode } from '../../interface';
import { DecryptedNode } from '../nodes';
import { SharingAPIService } from './apiService';
import { SharingCache } from './cache';
import { SharingCryptoService } from './cryptoService';
import { SharesService, NodesService } from './interface';
export declare const BATCH_LOADING_SIZE = 30;
/**
 * Provides high-level actions for access shared nodes.
 *
 * The manager is responsible for listing shared by me, shared with me,
 * invitations, bookmarks, etc., including API communication, encryption,
 * decryption, and caching.
 */
export declare class SharingAccess {
    private apiService;
    private cache;
    private cryptoService;
    private sharesService;
    private nodesService;
    constructor(apiService: SharingAPIService, cache: SharingCache, cryptoService: SharingCryptoService, sharesService: SharesService, nodesService: NodesService);
    iterateSharedNodes(signal?: AbortSignal): AsyncGenerator<DecryptedNode>;
    iterateSharedNodesWithMe(signal?: AbortSignal): AsyncGenerator<DecryptedNode>;
    private iterateSharedNodesFromCache;
    private iterateSharedNodesFromAPI;
    private iterateNodesAndIgnoreMissingOnes;
    removeSharedNodeWithMe(nodeUid: string): Promise<void>;
    iterateInvitations(signal?: AbortSignal): AsyncGenerator<ProtonInvitationWithNode>;
    acceptInvitation(invitationUid: string): Promise<void>;
    rejectInvitation(invitationUid: string): Promise<void>;
    iterateBookmarks(signal?: AbortSignal): AsyncGenerator<MaybeBookmark>;
    deleteBookmark(bookmarkUid: string): Promise<void>;
}
