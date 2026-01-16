import { Logger, ProtonDriveTelemetry } from '../interface';
export declare function getMockTelemetry(): ProtonDriveTelemetry & {
    mockLogger: Logger;
};
