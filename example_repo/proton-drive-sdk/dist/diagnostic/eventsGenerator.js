"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGenerator = void 0;
/**
 * A base class for class that should provide diagnostic events
 * as a separate generator. Simply inherit from this class and use
 * `enqueueEvent` to enqueue the observed events. The events will be
 * available via `iterateEvents` generator.
 */
class EventsGenerator {
    eventQueue = [];
    waitingResolvers = [];
    enqueueEvent(event) {
        this.eventQueue.push(event);
        // Notify all waiting generators
        const resolvers = this.waitingResolvers.splice(0);
        resolvers.forEach((resolve) => resolve());
    }
    async *iterateEvents() {
        try {
            while (true) {
                if (this.eventQueue.length === 0) {
                    await this.waitForEvent();
                }
                while (this.eventQueue.length > 0) {
                    const event = this.eventQueue.shift();
                    if (event) {
                        yield event;
                    }
                }
            }
        }
        finally {
            this.waitingResolvers.splice(0);
        }
    }
    waitForEvent() {
        return new Promise((resolve) => {
            if (this.eventQueue.length > 0) {
                resolve();
            }
            else {
                this.waitingResolvers.push(resolve);
            }
        });
    }
}
exports.EventsGenerator = EventsGenerator;
//# sourceMappingURL=eventsGenerator.js.map