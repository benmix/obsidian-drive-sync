import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requestUrlMock = vi.hoisted(() => vi.fn());

vi.mock("obsidian", () => ({
	requestUrl: requestUrlMock,
}));

import { requestHttp } from "../../src/provider/providers/proton-drive/sdk/proton-auth/transport/http";

describe("requestHttp", () => {
	beforeEach(() => {
		requestUrlMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("rejects with AbortError when the timeout elapses", async () => {
		vi.useFakeTimers();
		requestUrlMock.mockImplementation(() => new Promise(() => {}));

		const request = requestHttp(
			"https://example.test/core/v4/users",
			{
				timeoutMs: 25,
			},
			"json",
		);
		const assertion = expect(request).rejects.toMatchObject({
			name: "AbortError",
			message: "Request timed out after 25ms.",
		});
		await vi.advanceTimersByTimeAsync(25);

		await assertion;
	});
});
