import { MaybeNode as PublicMaybeNode, MaybeMissingNode as PublicMaybeMissingNode, Revision as PublicRevision, Result, MissingNode, MaybePhotoNode as PublicMaybePhotoNode, MaybeMissingPhotoNode as PublicMaybeMissingPhotoNode } from './interface';
import { DecryptedNode as InternalNode, DecryptedRevision as InternalRevision } from './internal/nodes';
import { DecryptedPhotoNode as InternalPartialPhotoNode } from './internal/photos';
type InternalPartialNode = Pick<InternalNode, 'uid' | 'parentUid' | 'name' | 'keyAuthor' | 'nameAuthor' | 'directRole' | 'membership' | 'type' | 'mediaType' | 'isShared' | 'isSharedPublicly' | 'creationTime' | 'modificationTime' | 'trashTime' | 'activeRevision' | 'folder' | 'totalStorageSize' | 'errors' | 'shareId' | 'treeEventScopeId'>;
type NodeUid = string | {
    uid: string;
} | Result<{
    uid: string;
}, {
    uid: string;
}>;
export declare function getUid(nodeUid: NodeUid): string;
export declare function getUids(nodeUids: NodeUid[]): string[];
export declare function convertInternalNodeIterator(nodeIterator: AsyncGenerator<InternalPartialNode>): AsyncGenerator<PublicMaybeNode>;
export declare function convertInternalMissingNodeIterator(nodeIterator: AsyncGenerator<InternalPartialNode | MissingNode>): AsyncGenerator<PublicMaybeMissingNode>;
export declare function convertInternalNodePromise(nodePromise: Promise<InternalPartialNode>): Promise<PublicMaybeNode>;
export declare function convertInternalNode(node: InternalPartialNode): PublicMaybeNode;
export declare function convertInternalPhotoNodeIterator(photoNodeIterator: AsyncGenerator<InternalPartialPhotoNode>): AsyncGenerator<PublicMaybePhotoNode>;
export declare function convertInternalMissingPhotoNodeIterator(photoNodeIterator: AsyncGenerator<InternalPartialPhotoNode | MissingNode>): AsyncGenerator<PublicMaybeMissingPhotoNode>;
export declare function convertInternalPhotoNodePromise(photoNodePromise: Promise<InternalPartialPhotoNode>): Promise<PublicMaybePhotoNode>;
export declare function convertInternalPhotoNode(photoNode: InternalPartialPhotoNode): PublicMaybePhotoNode;
export declare function convertInternalRevisionIterator(revisionIterator: AsyncGenerator<InternalRevision>): AsyncGenerator<PublicRevision>;
export {};
