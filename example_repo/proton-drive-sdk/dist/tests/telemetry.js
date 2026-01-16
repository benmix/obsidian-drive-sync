"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMockTelemetry = getMockTelemetry;
const logger_1 = require("./logger");
function getMockTelemetry() {
    const mockLogger = (0, logger_1.getMockLogger)();
    return {
        mockLogger,
        getLogger: () => mockLogger,
        recordMetric: jest.fn(),
    };
}
//# sourceMappingURL=telemetry.js.map