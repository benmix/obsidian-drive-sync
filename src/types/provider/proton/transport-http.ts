export type ResponseType = "json" | "text" | "arrayBuffer";

export type HttpOptions = {
	method?: string;
	headers?: Headers | Record<string, string> | [string, string][];
	body?: BodyInit | null;
	timeoutMs?: number;
	signal?: AbortSignal;
};

export type PreparedBody = {
	body?: string | ArrayBuffer;
	contentType?: string;
};
