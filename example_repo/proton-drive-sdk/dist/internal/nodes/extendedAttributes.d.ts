import { Logger } from '../../interface';
export interface FolderExtendedAttributes {
    claimedModificationTime?: Date;
}
export interface FileExtendedAttributesParsed {
    claimedSize?: number;
    claimedModificationTime?: Date;
    claimedDigests?: {
        sha1?: string;
    };
    claimedAdditionalMetadata?: object;
    claimedBlockSizes?: number[];
}
export declare function generateFolderExtendedAttributes(claimedModificationTime?: Date): string | undefined;
export declare function parseFolderExtendedAttributes(logger: Logger, extendedAttributes?: string): FolderExtendedAttributes;
export declare function generateFileExtendedAttributes(common: {
    modificationTime?: Date;
    size?: number;
    blockSizes?: number[];
    digests?: {
        sha1?: string;
    };
}, additionalMetadata?: object): string | undefined;
export declare function parseFileExtendedAttributes(logger: Logger, creationTime: Date, extendedAttributes?: string): FileExtendedAttributesParsed;
