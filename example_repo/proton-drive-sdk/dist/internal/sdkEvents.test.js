"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interface_1 = require("../interface");
const sdkEvents_1 = require("./sdkEvents");
describe('SDKEvents', () => {
    let sdkEvents;
    let logger;
    beforeEach(() => {
        logger = { debug: jest.fn() };
        sdkEvents = new sdkEvents_1.SDKEvents({ getLogger: () => logger });
    });
    it('should log when no listeners are present for an event', () => {
        sdkEvents.requestsThrottled();
        expect(logger.debug).toHaveBeenCalledWith('No listeners for event: requestsThrottled');
    });
    it('should emit an event to its listeners', () => {
        const requestsThrottledListener = jest.fn();
        sdkEvents.addListener(interface_1.SDKEvent.RequestsThrottled, requestsThrottledListener);
        const requestsUnthrottledListener = jest.fn();
        sdkEvents.addListener(interface_1.SDKEvent.RequestsUnthrottled, requestsUnthrottledListener);
        sdkEvents.requestsThrottled();
        expect(requestsThrottledListener).toHaveBeenCalled();
        expect(requestsUnthrottledListener).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith('Emitting event: requestsThrottled');
    });
    it('should emit an event to multiple listeners', () => {
        const requestsThrottledListener1 = jest.fn();
        const requestsThrottledListener2 = jest.fn();
        sdkEvents.addListener(interface_1.SDKEvent.RequestsThrottled, requestsThrottledListener1);
        sdkEvents.addListener(interface_1.SDKEvent.RequestsThrottled, requestsThrottledListener2);
        sdkEvents.requestsThrottled();
        expect(requestsThrottledListener1).toHaveBeenCalled();
        expect(requestsThrottledListener2).toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith('Emitting event: requestsThrottled');
    });
    it('should not emit after unsubsribe', () => {
        const callback = jest.fn();
        const unsubscribe = sdkEvents.addListener(interface_1.SDKEvent.RequestsThrottled, callback);
        sdkEvents.requestsThrottled();
        unsubscribe();
        sdkEvents.requestsThrottled();
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=sdkEvents.test.js.map