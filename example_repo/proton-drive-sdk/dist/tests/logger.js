"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMockLogger = getMockLogger;
function getMockLogger() {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
}
//# sourceMappingURL=logger.js.map