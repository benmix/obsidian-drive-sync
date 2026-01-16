import { MaybeNode, NodeType, Revision } from '../interface';
import { NodeDetails, ExpectedTreeNode } from './interface';
export declare function getNodeDetails(node: MaybeNode): NodeDetails;
export declare function getNodeUids(node: MaybeNode): {
    nodeUid: string;
    revisionUid: string | undefined;
};
export declare function getNodeType(node: MaybeNode): NodeType;
export declare function getMediaType(node: MaybeNode): string | undefined;
export declare function getActiveRevision(node: MaybeNode): Revision | undefined;
export declare function getNodeName(node: MaybeNode): string;
export declare function getExpectedTreeNodeDetails(expectedNode: ExpectedTreeNode): ExpectedTreeNode;
export declare function getTreeNodeChildByNodeName(expectedSubtree: ExpectedTreeNode | undefined, nodeName: string): ExpectedTreeNode | undefined;
