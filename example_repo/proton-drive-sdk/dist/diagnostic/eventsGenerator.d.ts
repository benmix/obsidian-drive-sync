import { DiagnosticResult } from './interface';
/**
 * A base class for class that should provide diagnostic events
 * as a separate generator. Simply inherit from this class and use
 * `enqueueEvent` to enqueue the observed events. The events will be
 * available via `iterateEvents` generator.
 */
export declare class EventsGenerator {
    private eventQueue;
    private waitingResolvers;
    protected enqueueEvent(event: DiagnosticResult): void;
    iterateEvents(): AsyncGenerator<DiagnosticResult>;
    private waitForEvent;
}
