"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFolderExtendedAttributes = generateFolderExtendedAttributes;
exports.parseFolderExtendedAttributes = parseFolderExtendedAttributes;
exports.generateFileExtendedAttributes = generateFileExtendedAttributes;
exports.parseFileExtendedAttributes = parseFileExtendedAttributes;
function generateFolderExtendedAttributes(claimedModificationTime) {
    if (!claimedModificationTime) {
        return undefined;
    }
    return JSON.stringify({
        Common: {
            ModificationTime: dateToIsoString(claimedModificationTime),
        },
    });
}
function dateToIsoString(date) {
    const isDateValid = !Number.isNaN(date.getTime());
    return isDateValid ? date.toISOString() : undefined;
}
function parseFolderExtendedAttributes(logger, extendedAttributes) {
    if (!extendedAttributes) {
        return {};
    }
    try {
        const parsed = JSON.parse(extendedAttributes);
        return {
            claimedModificationTime: parseModificationTime(logger, parsed),
        };
    }
    catch (error) {
        logger.error(`Failed to parse extended attributes`, error);
        return {};
    }
}
function generateFileExtendedAttributes(common, additionalMetadata) {
    if (additionalMetadata && 'Common' in additionalMetadata) {
        throw new Error('Common attributes are not allowed in additional metadata');
    }
    const commonAttributes = {};
    if (common.modificationTime) {
        commonAttributes.ModificationTime = dateToIsoString(common.modificationTime);
    }
    if (common.size !== undefined) {
        commonAttributes.Size = common.size;
    }
    if (common.blockSizes?.length) {
        commonAttributes.BlockSizes = common.blockSizes;
    }
    if (common.digests?.sha1) {
        commonAttributes.Digests = {
            SHA1: common.digests.sha1,
        };
    }
    if (!Object.keys(commonAttributes).length && !additionalMetadata) {
        return undefined;
    }
    return JSON.stringify({
        ...(Object.keys(commonAttributes).length ? { Common: commonAttributes } : {}),
        ...(additionalMetadata ? { ...additionalMetadata } : {}),
    });
}
function parseFileExtendedAttributes(logger, creationTime, extendedAttributes) {
    if (!extendedAttributes) {
        return {};
    }
    try {
        const parsed = JSON.parse(extendedAttributes);
        const claimedAdditionalMetadata = { ...parsed };
        delete claimedAdditionalMetadata.Common;
        return {
            claimedSize: parseSize(logger, parsed),
            claimedModificationTime: parseModificationTime(logger, parsed),
            claimedDigests: parseDigests(logger, parsed),
            claimedAdditionalMetadata: Object.keys(claimedAdditionalMetadata).length
                ? claimedAdditionalMetadata
                : undefined,
            claimedBlockSizes: parseBlockSizes(logger, creationTime, parsed),
        };
    }
    catch (error) {
        logger.error(`Failed to parse extended attributes`, error);
        return {};
    }
}
function parseSize(logger, xattr) {
    const size = xattr?.Common?.Size;
    if (size === undefined) {
        return undefined;
    }
    if (typeof size !== 'number') {
        logger.warn(`XAttr file size "${size}" is not valid`);
        return undefined;
    }
    return size;
}
function parseModificationTime(logger, xattr) {
    const modificationTime = xattr?.Common?.ModificationTime;
    if (modificationTime === undefined) {
        return undefined;
    }
    const modificationDate = new Date(modificationTime);
    // This is the best way to check if date is "Invalid Date". :shrug:
    if (JSON.stringify(modificationDate) === 'null') {
        logger.warn(`XAttr modification time "${modificationTime}" is not valid`);
        return undefined;
    }
    return modificationDate;
}
function parseDigests(logger, xattr) {
    const digests = xattr?.Common?.Digests;
    if (digests === undefined || digests.SHA1 === undefined) {
        return undefined;
    }
    const sha1 = digests.SHA1;
    if (typeof sha1 !== 'string') {
        logger.warn(`XAttr digest SHA1 "${sha1}" is not valid`);
        return undefined;
    }
    return {
        sha1,
    };
}
function parseBlockSizes(logger, creationTime, xattr) {
    const blockSizes = xattr?.Common?.BlockSizes;
    if (blockSizes === undefined) {
        return undefined;
    }
    if (!Array.isArray(blockSizes)) {
        logger.warn(`XAttr block sizes "${JSON.stringify(blockSizes)}" is not valid`);
        return undefined;
    }
    if (blockSizes.some((size) => typeof size !== 'number' || size <= 0)) {
        logger.warn(`XAttr block sizes "${JSON.stringify(blockSizes)}" is not valid`);
        return undefined;
    }
    if (blockSizes.length === 0) {
        return undefined;
    }
    // Before 2025, there was a bug on the Windows client that didn't sort
    // the block sizes in correct order. Because the sizes were all the same
    // except the last one, which was always smaller, the block sizes must be
    // sorted in descending order.
    if (creationTime < new Date('2025-01-01')) {
        return blockSizes.sort((a, b) => b - a);
    }
    return blockSizes;
}
//# sourceMappingURL=extendedAttributes.js.map