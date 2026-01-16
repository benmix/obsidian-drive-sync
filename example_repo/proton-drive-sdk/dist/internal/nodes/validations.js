"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNodeName = validateNodeName;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
const MAX_NODE_NAME_LENGTH = 255;
/**
 * @throws Error if the name is empty, long, or includes slash in the name.
 */
function validateNodeName(name) {
    if (!name) {
        throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Name must not be empty`);
    }
    if (name.length > MAX_NODE_NAME_LENGTH) {
        throw new errors_1.ValidationError((0, ttag_1.c)('Error').ngettext((0, ttag_1.msgid) `Name must be ${MAX_NODE_NAME_LENGTH} character long at most`, `Name must be ${MAX_NODE_NAME_LENGTH} characters long at most`, MAX_NODE_NAME_LENGTH));
    }
    if (name.includes('/')) {
        throw new errors_1.ValidationError((0, ttag_1.c)('Error').t `Name must not contain the character '/'`);
    }
}
//# sourceMappingURL=validations.js.map