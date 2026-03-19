import { requestUrl } from "obsidian";

type ResponseType = "json" | "text" | "arrayBuffer";

type HttpOptions = {
	method?: string;
	headers?: Headers | Record<string, string> | [string, string][];
	body?: BodyInit | null;
	timeoutMs?: number;
	signal?: AbortSignal;
};

type PreparedBody = {
	body?: string | ArrayBuffer;
	contentType?: string;
};

function normalizeHeaders(
	headers?: Headers | Record<string, string> | [string, string][],
): Record<string, string> {
	if (!headers) {
		return {};
	}
	if (headers instanceof Headers) {
		const entries: [string, string][] = [];
		headers.forEach((value, key) => {
			entries.push([key, value]);
		});
		return Object.fromEntries(entries);
	}
	if (Array.isArray(headers)) {
		return Object.fromEntries(headers);
	}
	return headers;
}

function buildResponse(
	status: number,
	headers: Record<string, string> | undefined,
	body: BodyInit | null,
): Response {
	const responseHeaders = new Headers();
	if (headers) {
		for (const [key, value] of Object.entries(headers)) {
			responseHeaders.set(key, value);
		}
	}
	return new Response(body, { status, headers: responseHeaders });
}

function hasContentType(headers: Record<string, string>): boolean {
	return Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
}

async function prepareBody(body?: BodyInit | null): Promise<PreparedBody> {
	if (body === undefined || body === null) {
		return {};
	}
	if (typeof body === "string" || body instanceof ArrayBuffer) {
		return { body };
	}
	if (ArrayBuffer.isView(body)) {
		return {
			body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
		};
	}

	// Obsidian requestUrl only accepts string/ArrayBuffer payloads. For FormData/Blob and
	// other BodyInit variants, serialize through Request so multipart boundaries are preserved.
	const request = new Request("https://obsidian.invalid", {
		method: "POST",
		body,
	});
	const contentType = request.headers.get("content-type") ?? undefined;
	const arrayBuffer = await request.arrayBuffer();
	return { body: arrayBuffer, contentType };
}

function createAbortError(reason: string): Error {
	const error = new Error(reason);
	error.name = "AbortError";
	return error;
}

export async function requestHttp(
	url: string,
	options: HttpOptions,
	responseType: ResponseType,
): Promise<Response> {
	if (typeof requestUrl !== "function") {
		throw new Error("requestUrl is not available in this environment.");
	}

	const headers = normalizeHeaders(options.headers);
	const prepared = await prepareBody(options.body);
	if (prepared.contentType && !hasContentType(headers)) {
		headers["content-type"] = prepared.contentType;
	}

	const requestPromise = requestUrl({
		url,
		method: options.method ?? "GET",
		headers,
		body: prepared.body,
		throw: false,
	});

	const timeoutMs = options.timeoutMs;
	const signal = options.signal;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let removeAbortListener: (() => void) | null = null;

	const guardPromises: Array<Promise<Awaited<typeof requestPromise>>> = [requestPromise];
	if (timeoutMs && timeoutMs > 0) {
		guardPromises.push(
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(createAbortError(`Request timed out after ${timeoutMs}ms.`));
				}, timeoutMs);
			}),
		);
	}
	if (signal) {
		guardPromises.push(
			new Promise<never>((_, reject) => {
				if (signal.aborted) {
					reject(createAbortError("Request was aborted."));
					return;
				}
				const onAbort = () => {
					reject(createAbortError("Request was aborted."));
				};
				signal.addEventListener("abort", onAbort, { once: true });
				removeAbortListener = () => {
					signal.removeEventListener("abort", onAbort);
				};
			}),
		);
	}

	const result = await Promise.race(guardPromises).finally(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		removeAbortListener?.();
	});

	let body: BodyInit | null = null;
	if (responseType === "arrayBuffer" && result.arrayBuffer) {
		body = result.arrayBuffer;
	} else if (responseType === "json") {
		if (typeof result.text === "string") {
			body = result.text;
		} else if (result.json) {
			body = JSON.stringify(result.json);
		}
	} else if (typeof result.text === "string") {
		body = result.text;
	}

	return buildResponse(result.status, result.headers, body);
}
