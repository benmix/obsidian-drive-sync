"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodesManagement = exports.NodesManagementBase = void 0;
const ttag_1 = require("ttag");
const interface_1 = require("../../interface");
const errors_1 = require("../../errors");
const errors_2 = require("../errors");
const uids_1 = require("../uids");
const errors_3 = require("./errors");
const extendedAttributes_1 = require("./extendedAttributes");
const nodeName_1 = require("./nodeName");
const validations_1 = require("./validations");
const AVAILABLE_NAME_BATCH_SIZE = 10;
const AVAILABLE_NAME_LIMIT = 1000;
/**
 * Provides high-level actions for managing nodes.
 *
 * The manager is responsible for handling nodes metadata, including
 * API communication, encryption, decryption, and caching.
 *
 * This module uses other modules providing low-level operations, such
 * as API service, cache, crypto service, etc.
 */
class NodesManagementBase {
    apiService;
    cryptoCache;
    cryptoService;
    nodesAccess;
    constructor(apiService, cryptoCache, cryptoService, nodesAccess) {
        this.apiService = apiService;
        this.cryptoCache = cryptoCache;
        this.cryptoService = cryptoService;
        this.nodesAccess = nodesAccess;
        this.apiService = apiService;
        this.cryptoCache = cryptoCache;
        this.cryptoService = cryptoService;
        this.nodesAccess = nodesAccess;
    }
    async renameNode(nodeUid, newName, options = { allowRenameRootNode: false }) {
        (0, validations_1.validateNodeName)(newName);
        const node = await this.nodesAccess.getNode(nodeUid);
        const { nameSessionKey: nodeNameSessionKey } = await this.nodesAccess.getNodePrivateAndSessionKeys(nodeUid);
        const parentKeys = await this.nodesAccess.getParentKeys(node);
        const signingKeys = await this.nodesAccess.getNodeSigningKeys({ nodeUid, parentNodeUid: node.parentUid });
        if (!options.allowRenameRootNode && (!node.hash || !parentKeys.hashKey)) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Renaming root item is not allowed`);
        }
        const { signatureEmail, armoredNodeName, hash } = await this.cryptoService.encryptNewName(parentKeys, nodeNameSessionKey, signingKeys, newName);
        // Because hash is optional, lets ensure we have it unless explicitely
        // allowed to rename root node.
        if (!options.allowRenameRootNode && !hash) {
            throw new Error('Node hash not generated');
        }
        try {
            await this.apiService.renameNode(nodeUid, {
                hash: node.hash,
            }, {
                encryptedName: armoredNodeName,
                nameSignatureEmail: signatureEmail,
                hash: hash,
            });
        }
        catch (error) {
            // If node is out of sync, we notify cache to refresh it before next usage.
            // We let the code still throw the error as it must bubble to the user
            // so user can re-open the node to ensure they still want to rename it.
            if (error instanceof errors_3.NodeOutOfSyncError) {
                await this.nodesAccess.notifyNodeChanged(nodeUid);
            }
            throw error;
        }
        await this.nodesAccess.notifyNodeChanged(nodeUid);
        const newNode = {
            ...node,
            name: (0, interface_1.resultOk)(newName),
            encryptedName: armoredNodeName,
            nameAuthor: (0, interface_1.resultOk)(signatureEmail || null),
            hash,
        };
        return newNode;
    }
    // Improvement requested: move nodes in parallel
    async *moveNodes(nodeUids, newParentNodeUid, signal) {
        for (const nodeUid of nodeUids) {
            if (signal?.aborted) {
                throw new errors_1.AbortError((0, ttag_1.c)('Error').t `Move operation aborted`);
            }
            try {
                await this.moveNode(nodeUid, newParentNodeUid);
                yield {
                    uid: nodeUid,
                    ok: true,
                };
            }
            catch (error) {
                yield {
                    uid: nodeUid,
                    ok: false,
                    error: (0, errors_2.getErrorMessage)(error),
                };
            }
        }
    }
    async emptyTrash() {
        const node = await this.nodesAccess.getVolumeRootFolder();
        const { volumeId } = (0, uids_1.splitNodeUid)(node.uid);
        await this.apiService.emptyTrash(volumeId);
    }
    async moveNode(nodeUid, newParentUid) {
        const node = await this.nodesAccess.getNode(nodeUid);
        const [keys, newParentKeys, signingKeys] = await Promise.all([
            this.nodesAccess.getNodePrivateAndSessionKeys(nodeUid),
            this.nodesAccess.getNodeKeys(newParentUid),
            this.nodesAccess.getNodeSigningKeys({ nodeUid, parentNodeUid: newParentUid }),
        ]);
        if (!node.hash) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Moving root item is not allowed`);
        }
        if (!newParentKeys.hashKey) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Moving item to a non-folder is not allowed`);
        }
        const encryptedCrypto = await this.cryptoService.encryptNodeWithNewParent(node.name, keys, { key: newParentKeys.key, hashKey: newParentKeys.hashKey }, signingKeys);
        // Node could be uploaded or renamed by anonymous user and thus have
        // missing signatures that must be added to the move request.
        // Node passphrase and signature email must be passed if and only if
        // the the signatures are missing (key author is null).
        const anonymousKey = node.keyAuthor.ok && node.keyAuthor.value === null;
        const keySignatureProperties = !anonymousKey
            ? {}
            : {
                signatureEmail: encryptedCrypto.signatureEmail,
                armoredNodePassphraseSignature: encryptedCrypto.armoredNodePassphraseSignature,
            };
        await this.apiService.moveNode(nodeUid, {
            hash: node.hash,
        }, {
            ...keySignatureProperties,
            parentUid: newParentUid,
            armoredNodePassphrase: encryptedCrypto.armoredNodePassphrase,
            encryptedName: encryptedCrypto.encryptedName,
            nameSignatureEmail: encryptedCrypto.nameSignatureEmail,
            hash: encryptedCrypto.hash,
            // TODO: When moving photos, we need to pass content hash.
        });
        const newNode = {
            ...node,
            encryptedName: encryptedCrypto.encryptedName,
            parentUid: newParentUid,
            hash: encryptedCrypto.hash,
            keyAuthor: (0, interface_1.resultOk)(encryptedCrypto.signatureEmail),
            nameAuthor: (0, interface_1.resultOk)(encryptedCrypto.nameSignatureEmail),
        };
        await this.nodesAccess.notifyNodeChanged(node.uid, newParentUid);
        return newNode;
    }
    // Improvement requested: copy nodes in parallel using copy_multiple endpoint
    async *copyNodes(nodeUidsOrWithNames, newParentNodeUid, signal) {
        for (const nodeUidOrWithName of nodeUidsOrWithNames) {
            if (signal?.aborted) {
                throw new errors_1.AbortError((0, ttag_1.c)('Error').t `Copy operation aborted`);
            }
            const nodeUid = typeof nodeUidOrWithName === 'string' ? nodeUidOrWithName : nodeUidOrWithName.uid;
            const name = typeof nodeUidOrWithName === 'string' ? undefined : nodeUidOrWithName.name;
            try {
                const { uid: newNodeUid } = await this.copyNode(nodeUid, newParentNodeUid, name);
                yield {
                    uid: nodeUid,
                    newUid: newNodeUid,
                    ok: true,
                };
            }
            catch (error) {
                yield {
                    uid: nodeUid,
                    ok: false,
                    error: (0, errors_2.createErrorFromUnknown)(error),
                };
            }
        }
    }
    async copyNode(nodeUid, newParentUid, name) {
        if (name) {
            (0, validations_1.validateNodeName)(name);
        }
        const node = await this.nodesAccess.getNode(nodeUid);
        const nodeName = name ? (0, interface_1.resultOk)(name) : node.name;
        const [keys, newParentKeys, signingKeys] = await Promise.all([
            this.nodesAccess.getNodePrivateAndSessionKeys(nodeUid),
            this.nodesAccess.getNodeKeys(newParentUid),
            this.nodesAccess.getNodeSigningKeys({ nodeUid, parentNodeUid: newParentUid }),
        ]);
        if (!newParentKeys.hashKey) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Copying item to a non-folder is not allowed`);
        }
        const encryptedCrypto = await this.cryptoService.encryptNodeWithNewParent(nodeName, keys, { key: newParentKeys.key, hashKey: newParentKeys.hashKey }, signingKeys);
        // Node could be uploaded or renamed by anonymous user and thus have
        // missing signatures that must be added to the copy request.
        // Node passphrase and signature email must be passed if and only if
        // the the signatures are missing (key author is null).
        const anonymousKey = node.keyAuthor.ok && node.keyAuthor.value === null;
        const keySignatureProperties = !anonymousKey
            ? {}
            : {
                signatureEmail: encryptedCrypto.signatureEmail,
                armoredNodePassphraseSignature: encryptedCrypto.armoredNodePassphraseSignature,
            };
        const newNodeUid = await this.apiService.copyNode(nodeUid, {
            ...keySignatureProperties,
            parentUid: newParentUid,
            armoredNodePassphrase: encryptedCrypto.armoredNodePassphrase,
            encryptedName: encryptedCrypto.encryptedName,
            nameSignatureEmail: encryptedCrypto.nameSignatureEmail,
            hash: encryptedCrypto.hash,
        });
        const newNode = {
            ...node,
            name: nodeName,
            uid: newNodeUid,
            encryptedName: encryptedCrypto.encryptedName,
            parentUid: newParentUid,
            hash: encryptedCrypto.hash,
            keyAuthor: (0, interface_1.resultOk)(encryptedCrypto.signatureEmail),
            nameAuthor: (0, interface_1.resultOk)(encryptedCrypto.nameSignatureEmail),
        };
        await this.nodesAccess.notifyChildCreated(newParentUid);
        return newNode;
    }
    async *trashNodes(nodeUids, signal) {
        for await (const result of this.apiService.trashNodes(nodeUids, signal)) {
            if (result.ok) {
                await this.nodesAccess.notifyNodeChanged(result.uid);
            }
            yield result;
        }
    }
    async *restoreNodes(nodeUids, signal) {
        for await (const result of this.apiService.restoreNodes(nodeUids, signal)) {
            if (result.ok) {
                await this.nodesAccess.notifyNodeChanged(result.uid);
            }
            yield result;
        }
    }
    async *deleteTrashedNodes(nodeUids, signal) {
        for await (const result of this.apiService.deleteTrashedNodes(nodeUids, signal)) {
            if (result.ok) {
                await this.nodesAccess.notifyNodeDeleted(result.uid);
            }
            yield result;
        }
    }
    // FIXME create test for create folder
    async createFolder(parentNodeUid, folderName, modificationTime) {
        (0, validations_1.validateNodeName)(folderName);
        const parentKeys = await this.nodesAccess.getNodeKeys(parentNodeUid);
        if (!parentKeys.hashKey) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Creating folders in non-folders is not allowed`);
        }
        const signingKeys = await this.nodesAccess.getNodeSigningKeys({ parentNodeUid });
        const extendedAttributes = (0, extendedAttributes_1.generateFolderExtendedAttributes)(modificationTime);
        const { encryptedCrypto, keys } = await this.cryptoService.createFolder({ key: parentKeys.key, hashKey: parentKeys.hashKey }, signingKeys, folderName, extendedAttributes);
        const nodeUid = await this.apiService.createFolder(parentNodeUid, {
            armoredKey: encryptedCrypto.armoredKey,
            armoredHashKey: encryptedCrypto.folder.armoredHashKey,
            armoredNodePassphrase: encryptedCrypto.armoredNodePassphrase,
            armoredNodePassphraseSignature: encryptedCrypto.armoredNodePassphraseSignature,
            signatureEmail: encryptedCrypto.signatureEmail,
            encryptedName: encryptedCrypto.encryptedName,
            hash: encryptedCrypto.hash,
            armoredExtendedAttributes: encryptedCrypto.folder.armoredExtendedAttributes,
        });
        await this.nodesAccess.notifyChildCreated(parentNodeUid);
        const node = this.generateNodeFolder(nodeUid, parentNodeUid, folderName, encryptedCrypto);
        await this.cryptoCache.setNodeKeys(nodeUid, keys);
        return node;
    }
    generateNodeFolderBase(nodeUid, parentNodeUid, name, encryptedCrypto) {
        return {
            // Internal metadata
            hash: encryptedCrypto.hash,
            encryptedName: encryptedCrypto.encryptedName,
            // Basic node metadata
            uid: nodeUid,
            parentUid: parentNodeUid,
            type: interface_1.NodeType.Folder,
            mediaType: 'Folder',
            creationTime: new Date(),
            modificationTime: new Date(),
            // Share node metadata
            isShared: false,
            isSharedPublicly: false,
            directRole: interface_1.MemberRole.Inherited,
            // Decrypted metadata
            isStale: false,
            keyAuthor: (0, interface_1.resultOk)(encryptedCrypto.signatureEmail || null),
            nameAuthor: (0, interface_1.resultOk)(encryptedCrypto.signatureEmail || null),
            name: (0, interface_1.resultOk)(name),
            treeEventScopeId: (0, uids_1.splitNodeUid)(nodeUid).volumeId,
        };
    }
    async findAvailableName(parentFolderUid, name) {
        const { hashKey: parentHashKey } = await this.nodesAccess.getNodeKeys(parentFolderUid);
        if (!parentHashKey) {
            throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Creating files in non-folders is not allowed`);
        }
        const [namePart, extension] = (0, nodeName_1.splitExtension)(name);
        let startIndex = 1;
        while (startIndex < AVAILABLE_NAME_LIMIT) {
            const namesToCheck = startIndex === 1 ? [name] : [];
            for (let i = startIndex; i < startIndex + AVAILABLE_NAME_BATCH_SIZE; i++) {
                namesToCheck.push((0, nodeName_1.joinNameAndExtension)(namePart, i, extension));
            }
            const hashesToCheck = await this.cryptoService.generateNameHashes(parentHashKey, namesToCheck);
            const { availableHashes } = await this.apiService.checkAvailableHashes(parentFolderUid, hashesToCheck.map(({ hash }) => hash));
            if (!availableHashes.length) {
                startIndex += AVAILABLE_NAME_BATCH_SIZE;
                continue;
            }
            const availableHash = hashesToCheck.find(({ hash }) => hash === availableHashes[0]);
            if (!availableHash) {
                throw Error('Backend returned unexpected hash');
            }
            return availableHash.name;
        }
        throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `No available name found`);
    }
}
exports.NodesManagementBase = NodesManagementBase;
class NodesManagement extends NodesManagementBase {
    generateNodeFolder(nodeUid, parentNodeUid, name, encryptedCrypto) {
        return this.generateNodeFolderBase(nodeUid, parentNodeUid, name, encryptedCrypto);
    }
}
exports.NodesManagement = NodesManagement;
//# sourceMappingURL=nodesManagement.js.map