import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requestUrlMock = vi.hoisted(() => vi.fn());

vi.mock("obsidian", () => ({
	requestUrl: requestUrlMock,
}));

import { requestHttp } from "@provider/providers/proton-drive/transport/http";

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

	test("rejects with AbortError when the caller aborts the request", async () => {
		requestUrlMock.mockImplementation(() => new Promise(() => {}));
		const controller = new AbortController();
		const request = requestHttp(
			"https://example.test/core/v4/users",
			{
				signal: controller.signal,
			},
			"json",
		);

		controller.abort();

		await expect(request).rejects.toMatchObject({
			name: "AbortError",
			message: "Request was aborted.",
		});
	});

	test("serializes form data bodies and returns JSON responses", async () => {
		requestUrlMock.mockResolvedValue({
			status: 201,
			headers: {
				"x-request-id": "req-1",
			},
			json: {
				Code: 1000,
			},
		});
		const body = new FormData();
		body.set("file", new Blob(["hello"], { type: "text/plain" }), "note.txt");

		const response = await requestHttp(
			"https://example.test/core/v4/upload",
			{
				method: "POST",
				headers: [["x-test", "1"]],
				body,
			},
			"json",
		);

		expect(requestUrlMock).toHaveBeenCalledWith(
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"x-test": "1",
					"content-type": expect.stringContaining("multipart/form-data"),
				}),
				body: expect.any(ArrayBuffer),
				throw: false,
			}),
		);
		await expect(response.json()).resolves.toEqual({
			Code: 1000,
		});
		expect(response.headers.get("x-request-id")).toBe("req-1");
	});
});
