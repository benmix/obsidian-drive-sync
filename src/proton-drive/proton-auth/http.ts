import { requestUrl } from "obsidian";

type ResponseType = "json" | "text" | "arrayBuffer";

type HttpOptions = {
	method?: string;
	headers?: Headers | Record<string, string> | [string, string][];
	body?: BodyInit | null;
	timeoutMs?: number;
	signal?: AbortSignal;
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

export async function requestHttp(
	url: string,
	options: HttpOptions,
	responseType: ResponseType,
): Promise<Response> {
	if (typeof requestUrl !== "function") {
		throw new Error("requestUrl is not available in this environment.");
	}

	const result = await requestUrl({
		url,
		method: options.method ?? "GET",
		headers: normalizeHeaders(options.headers),
		body:
			typeof options.body === "string" || options.body instanceof ArrayBuffer
				? options.body
				: undefined,
		throw: false,
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
