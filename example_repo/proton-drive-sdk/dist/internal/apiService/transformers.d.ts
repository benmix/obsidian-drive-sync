import { Logger, NodeType, MemberRole } from '../../interface';
export declare function nodeTypeNumberToNodeType(logger: Logger, nodeTypeNumber: number): NodeType;
export declare function permissionsToMemberRole(logger: Logger, permissionsNumber?: number): MemberRole;
export declare function memberRoleToPermission(memberRole: MemberRole): 4 | 6 | 22;
