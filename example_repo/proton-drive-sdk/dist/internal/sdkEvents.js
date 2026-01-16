"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKEvents = void 0;
const interface_1 = require("../interface");
class SDKEvents {
    logger;
    listeners = new Map();
    constructor(telemetry) {
        this.logger = telemetry.getLogger('sdk-events');
    }
    addListener(eventName, callback) {
        this.listeners.set(eventName, [...(this.listeners.get(eventName) || []), callback]);
        return () => {
            this.listeners.set(eventName, this.listeners.get(eventName)?.filter((cb) => cb !== callback) || []);
        };
    }
    transfersPaused() {
        this.emit(interface_1.SDKEvent.TransfersPaused);
    }
    transfersResumed() {
        this.emit(interface_1.SDKEvent.TransfersResumed);
    }
    requestsThrottled() {
        this.emit(interface_1.SDKEvent.RequestsThrottled);
    }
    requestsUnthrottled() {
        this.emit(interface_1.SDKEvent.RequestsUnthrottled);
    }
    emit(eventName) {
        if (!this.listeners.get(eventName)?.length) {
            this.logger.debug(`No listeners for event: ${eventName}`);
            return;
        }
        this.logger.debug(`Emitting event: ${eventName}`);
        this.listeners.get(eventName)?.forEach((callback) => callback());
    }
}
exports.SDKEvents = SDKEvents;
//# sourceMappingURL=sdkEvents.js.map