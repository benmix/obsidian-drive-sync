import { EventManagerInterface, Event, EventSubscription } from './interface';
type Listener<T> = (event: T) => Promise<void>;
/**
 * Event manager general helper that is responsible for fetching events
 * from the server and notifying listeners about the events.
 *
 * The specific implementation of fetching the events from the API must
 * be passed as dependency and can be used for any type of events that
 * supports the same structure.
 *
 * The manager will not start fetching events until the `start` method is
 * called. Once started, the manager will fetch events in a loop with
 * a timeout between each fetch. The default timeout is 30 seconds and
 * additional jitter is used in case of failure.
 */
export declare class EventManager<T extends Event> {
    private specializedEventManager;
    private pollingIntervalInSeconds;
    private logger;
    private latestEventId?;
    private timeoutHandle?;
    private processPromise?;
    private listeners;
    private retryIndex;
    constructor(specializedEventManager: EventManagerInterface<T>, pollingIntervalInSeconds: number, latestEventId: string | null);
    start(): Promise<void>;
    addListener(callback: Listener<T>): EventSubscription;
    setPollingInterval(pollingIntervalInSeconds: number): void;
    stop(): Promise<void>;
    private notifyListeners;
    private processEvents;
    private scheduleNextPoll;
    /**
     * Polling timeout is using exponential backoff with Fibonacci sequence.
     */
    private get nextPollTimeout();
}
export {};
