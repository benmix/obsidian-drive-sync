"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../../errors");
const interface_1 = require("../../interface");
const telemetry_1 = require("../../tests/telemetry");
const apiService_1 = require("./apiService");
jest.useFakeTimers();
function generateOkResponse() {
    return new Response(JSON.stringify({ Code: 1000 /* ErrorCode.OK */ }), { status: 200 /* HTTPErrorCode.OK */ });
}
describe('DriveAPIService', () => {
    let sdkEvents;
    let httpClient;
    let api;
    beforeEach(() => {
        void jest.runAllTimersAsync();
        // @ts-expect-error: No need to implement all methods for mocking
        sdkEvents = {
            transfersPaused: jest.fn(),
            transfersResumed: jest.fn(),
            requestsThrottled: jest.fn(),
            requestsUnthrottled: jest.fn(),
        };
        httpClient = {
            fetchJson: jest.fn(() => Promise.resolve(generateOkResponse())),
            fetchBlob: jest.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3])))),
        };
        api = new apiService_1.DriveAPIService((0, telemetry_1.getMockTelemetry)(), sdkEvents, httpClient, 'http://drive.proton.me', 'en');
    });
    function expectSDKEvents(...events) {
        expect(sdkEvents.transfersPaused).toHaveBeenCalledTimes(events.includes(interface_1.SDKEvent.TransfersPaused) ? 1 : 0);
        expect(sdkEvents.transfersResumed).toHaveBeenCalledTimes(events.includes(interface_1.SDKEvent.TransfersResumed) ? 1 : 0);
        expect(sdkEvents.requestsThrottled).toHaveBeenCalledTimes(events.includes(interface_1.SDKEvent.RequestsThrottled) ? 1 : 0);
        expect(sdkEvents.requestsUnthrottled).toHaveBeenCalledTimes(events.includes(interface_1.SDKEvent.RequestsUnthrottled) ? 1 : 0);
    }
    describe('should make', () => {
        it('GET request', async () => {
            const result = await api.get('test');
            expect(result).toEqual({ Code: 1000 /* ErrorCode.OK */ });
            await expectFetchJsonToBeCalledWith('GET');
        });
        it('POST request', async () => {
            const result = await api.post('test', { data: 'test' });
            expect(result).toEqual({ Code: 1000 /* ErrorCode.OK */ });
            await expectFetchJsonToBeCalledWith('POST', { data: 'test' });
        });
        it('PUT request', async () => {
            const result = await api.put('test', { data: 'test' });
            expect(result).toEqual({ Code: 1000 /* ErrorCode.OK */ });
            await expectFetchJsonToBeCalledWith('PUT', { data: 'test' });
        });
        async function expectFetchJsonToBeCalledWith(method, data) {
            // @ts-expect-error: Fetch is mock.
            const request = httpClient.fetchJson.mock.calls[0][0];
            expect(request.method).toEqual(method);
            expect(request.timeoutMs).toEqual(30000);
            expect(Array.from(request.headers.entries())).toEqual(Array.from(new Headers({
                Accept: 'application/vnd.protonmail.v1+json',
                'Content-Type': 'application/json',
                Language: 'en',
                'x-pm-drive-sdk-version': `js@${process.env.npm_package_version}`,
            }).entries()));
            expect(await request.json).toEqual(data);
            expectSDKEvents();
        }
        it('storage GET request', async () => {
            const stream = await api.getBlockStream('test', 'token');
            const result = await Array.fromAsync(stream);
            expect(result).toEqual([new Uint8Array([1, 2, 3])]);
            await expectFetchBlobToBeCalledWith('GET');
        });
        it('storage POST request', async () => {
            const data = new Blob();
            await api.postBlockStream('test', 'token', data);
            await expectFetchBlobToBeCalledWith('POST', data);
        });
        async function expectFetchBlobToBeCalledWith(method, data) {
            // @ts-expect-error: Fetch is mock.
            const request = httpClient.fetchBlob.mock.calls[0][0];
            expect(request.method).toEqual(method);
            expect(request.timeoutMs).toEqual(600_000);
            expect(Array.from(request.headers.entries())).toEqual(Array.from(new Headers({
                'pm-storage-token': 'token',
                Language: 'en',
                'x-pm-drive-sdk-version': `js@${process.env.npm_package_version}`,
            }).entries()));
            expect(request.body).toEqual(data);
            expectSDKEvents();
        }
    });
    describe('should throw', () => {
        it('AbortError on aborted error from the provided HTTP client', async () => {
            const abortError = new Error('AbortError');
            abortError.name = 'AbortError';
            httpClient.fetchJson = jest.fn(() => Promise.reject(abortError));
            await expect(api.get('test')).rejects.toThrow(new errors_1.AbortError('Request aborted'));
            expectSDKEvents();
        });
        it('APIHTTPError on 4xx response without JSON body', async () => {
            httpClient.fetchJson = jest.fn(() => Promise.resolve(new Response('Not found', { status: 404, statusText: 'Not found' })));
            await expect(api.get('test')).rejects.toThrow(new Error('Not found'));
            expectSDKEvents();
        });
        it('APIError on 4xx response with JSON body', async () => {
            httpClient.fetchJson = jest.fn(() => Promise.resolve(new Response(JSON.stringify({ Code: 42, Error: 'General error' }), { status: 422 })));
            await expect(api.get('test')).rejects.toThrow('General error');
            expectSDKEvents();
        });
    });
    describe('should retry', () => {
        it('on offline error', async () => {
            const error = new Error('Network offline');
            error.name = 'OfflineError';
            httpClient.fetchJson = jest
                .fn()
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce(generateOkResponse());
            const result = api.get('test');
            await expect(result).resolves.toEqual({ Code: 1000 /* ErrorCode.OK */ });
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(3);
            expectSDKEvents();
        });
        it('on timeout error', async () => {
            const error = new Error('Timeouted');
            error.name = 'TimeoutError';
            httpClient.fetchJson = jest
                .fn()
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce(generateOkResponse());
            const result = api.get('test');
            await expect(result).resolves.toEqual({ Code: 1000 /* ErrorCode.OK */ });
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(3);
            expectSDKEvents();
        });
        it('on general error', async () => {
            httpClient.fetchJson = jest
                .fn()
                .mockRejectedValueOnce(new Error('Error'))
                .mockResolvedValueOnce(generateOkResponse());
            const result = api.get('test');
            await expect(result).resolves.toEqual({ Code: 1000 /* ErrorCode.OK */ });
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(2);
            expectSDKEvents();
        });
        it('only once on general error', async () => {
            httpClient.fetchJson = jest
                .fn()
                .mockRejectedValueOnce(new Error('First error'))
                .mockRejectedValueOnce(new Error('Second error'))
                .mockResolvedValueOnce(generateOkResponse());
            const result = api.get('test');
            await expect(result).rejects.toThrow('Second error');
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(2);
            expectSDKEvents();
        });
        it('on 429 response', async () => {
            httpClient.fetchJson = jest
                .fn()
                .mockResolvedValueOnce(new Response('', { status: 429 /* HTTPErrorCode.TOO_MANY_REQUESTS */, statusText: 'Some error' }))
                .mockResolvedValueOnce(new Response('', { status: 429 /* HTTPErrorCode.TOO_MANY_REQUESTS */, statusText: 'Some error' }))
                .mockResolvedValueOnce(generateOkResponse());
            const result = api.get('test');
            await expect(result).resolves.toEqual({ Code: 1000 /* ErrorCode.OK */ });
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(3);
            // No event is sent on random 429, only if limit of too many subsequent 429s is reached.
            expectSDKEvents();
        });
        it('on 5xx response', async () => {
            httpClient.fetchJson = jest
                .fn()
                .mockResolvedValueOnce(new Response('', { status: 500 /* HTTPErrorCode.INTERNAL_SERVER_ERROR */, statusText: 'Some error' }))
                .mockResolvedValueOnce(generateOkResponse());
            const result = api.get('test');
            await expect(result).resolves.toEqual({ Code: 1000 /* ErrorCode.OK */ });
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(2);
            expectSDKEvents();
        });
        it('only once on 5xx response', async () => {
            httpClient.fetchJson = jest
                .fn()
                .mockResolvedValue(new Response('', { status: 500 /* HTTPErrorCode.INTERNAL_SERVER_ERROR */, statusText: 'Some error' }));
            const result = api.get('test');
            await expect(result).rejects.toThrow('Some error');
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(2);
            expectSDKEvents();
        });
    });
    describe('should handle subsequent errors', () => {
        it('limit timeout errors', async () => {
            const error = new Error('TimeoutError');
            error.name = 'TimeoutError';
            httpClient.fetchJson = jest.fn().mockRejectedValue(error);
            await expect(api.get('test')).rejects.toThrow(error);
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(3);
            expectSDKEvents();
        });
        it('limit 429 errors', async () => {
            httpClient.fetchJson = jest
                .fn()
                .mockResolvedValue(new Response('', { status: 429 /* HTTPErrorCode.TOO_MANY_REQUESTS */, statusText: 'Some error' }));
            for (let i = 0; i < 20; i++) {
                await api.get('test').catch(() => { });
            }
            await expect(api.get('test')).rejects.toThrow('Too many server requests, please try again later');
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(50);
            expectSDKEvents(interface_1.SDKEvent.RequestsThrottled);
            // SDK will not send any requests for 60 seconds.
            jest.advanceTimersByTime(90 * 1000);
            httpClient.fetchJson = jest.fn().mockResolvedValue(generateOkResponse());
            await api.get('test');
            expect(sdkEvents.requestsThrottled).toHaveBeenCalledTimes(1);
        });
        it('do not limit 429s when some pass', async () => {
            let attempt = 0;
            httpClient.fetchJson = jest.fn().mockImplementation(() => {
                if (attempt++ % 5 === 0) {
                    return generateOkResponse();
                }
                return new Response('', { status: 429 /* HTTPErrorCode.TOO_MANY_REQUESTS */, statusText: 'Some error' });
            });
            for (let i = 0; i < 20; i++) {
                await api.get('test').catch(() => { });
            }
            await expect(api.get('test')).resolves.toEqual({ Code: 1000 /* ErrorCode.OK */ });
            // 20 calls * 5 retries till OK response + 1 last successful call
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(101);
            expectSDKEvents();
        });
        it('limit server errors', async () => {
            httpClient.fetchJson = jest
                .fn()
                .mockResolvedValue(new Response('', { status: 500 /* HTTPErrorCode.INTERNAL_SERVER_ERROR */, statusText: 'Some error' }));
            for (let i = 0; i < 20; i++) {
                await api.get('test').catch(() => { });
            }
            await expect(api.get('test')).rejects.toThrow('Too many server errors, please try again later');
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(10);
            expectSDKEvents();
        });
        it('do not limit server errors when some pass', async () => {
            let attempt = 0;
            httpClient.fetchJson = jest.fn().mockImplementation(() => {
                if (attempt++ % 5 === 0) {
                    return generateOkResponse();
                }
                return new Response('', { status: 500 /* HTTPErrorCode.INTERNAL_SERVER_ERROR */, statusText: 'Some error' });
            });
            for (let i = 0; i < 20; i++) {
                await api.get('test').catch(() => { });
            }
            await expect(api.get('test')).rejects.toThrow('Some error');
            // 15 erroring calls * 2 attempts + 5 successful calls
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(35);
            expectSDKEvents();
        });
        it('notify about offline error', async () => {
            jest.useFakeTimers();
            const offlineError = new Error('OfflineError');
            offlineError.name = 'OfflineError';
            let attempt = 0;
            httpClient.fetchJson = jest.fn().mockImplementation(() => {
                if (attempt++ >= 15) {
                    return generateOkResponse();
                }
                throw offlineError;
            });
            const promise = api.get('test');
            // First 9 calls (first is immediate, then 8 with 5 second delay), no events are sent yet
            await jest.advanceTimersByTimeAsync(5 * 8 * 1000);
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(9);
            expectSDKEvents();
            // 10th call, service sends TransfersPaused event
            await jest.advanceTimersByTimeAsync(5 * 1000);
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(10);
            expectSDKEvents(interface_1.SDKEvent.TransfersPaused);
            // Next 5 calls, still offline, no more events are sent
            await jest.advanceTimersByTimeAsync(5 * 5 * 1000);
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(15);
            expectSDKEvents(interface_1.SDKEvent.TransfersPaused);
            // 16th call, mock returns OK response, service sends TransfersResumed event
            await jest.advanceTimersByTimeAsync(5 * 1000);
            expect(httpClient.fetchJson).toHaveBeenCalledTimes(16);
            expectSDKEvents(interface_1.SDKEvent.TransfersPaused, interface_1.SDKEvent.TransfersResumed);
            await promise;
        });
    });
});
//# sourceMappingURL=apiService.test.js.map