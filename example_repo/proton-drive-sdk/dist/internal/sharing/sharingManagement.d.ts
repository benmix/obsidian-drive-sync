import { Logger, ShareNodeSettings, UnshareNodeSettings, ShareResult, ProtonDriveAccount } from '../../interface';
import { SharingAPIService } from './apiService';
import { SharingCryptoService } from './cryptoService';
import { SharesService, NodesService, ShareResultWithCreatorEmail } from './interface';
import { SharingCache } from './cache';
/**
 * Provides high-level actions for managing sharing.
 *
 * The manager is responsible for sharing and unsharing nodes, and providing
 * sharing details of nodes.
 */
export declare class SharingManagement {
    private logger;
    private apiService;
    private cache;
    private cryptoService;
    private account;
    private sharesService;
    private nodesService;
    constructor(logger: Logger, apiService: SharingAPIService, cache: SharingCache, cryptoService: SharingCryptoService, account: ProtonDriveAccount, sharesService: SharesService, nodesService: NodesService);
    getSharingInfo(nodeUid: string): Promise<ShareResultWithCreatorEmail | undefined>;
    private iterateShareInvitations;
    private iterateShareExternalInvitations;
    private iterateShareMembers;
    private getPublicLink;
    shareNode(nodeUid: string, settings: ShareNodeSettings): Promise<ShareResult>;
    unshareNode(nodeUid: string, settings?: UnshareNodeSettings): Promise<ShareResult | undefined>;
    private getInternalSharingInfo;
    private createShare;
    /**
     * Deletes the share even if it is not empty.
     */
    private deleteShareWithForce;
    private inviteProtonUser;
    private updateInvitation;
    resendInvitationEmail(nodeUid: string, invitationUid: string): Promise<void>;
    private deleteInvitation;
    private inviteExternalUser;
    private updateExternalInvitation;
    private deleteExternalInvitation;
    private convertExternalInvitationsToInternal;
    private removeMember;
    private updateMember;
    private shareViaLink;
    private updateSharedLink;
    private removeSharedLink;
}
