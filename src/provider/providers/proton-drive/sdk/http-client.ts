import type { Session } from "@contracts/provider/proton/auth-types";
import { API_BASE_URL, APP_VERSION } from "@contracts/provider/proton/auth-types";
import type {
	ProtonDriveHTTPClient,
	ProtonDriveHTTPClientBlobRequest,
	ProtonDriveHTTPClientJsonRequest,
} from "@protontech/drive-sdk";
import { requestHttp } from "@provider/providers/proton-drive/transport/http";

export function createProtonHttpClient(
	session: Session | (() => Session | null),
	onTokenRefresh?: () => Promise<void>,
): ProtonDriveHTTPClient {
	const getSession = (): Session | null => (typeof session === "function" ? session() : session);

	const buildUrl = (url: string): string => {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			return url;
		}
		return `${API_BASE_URL}/${url}`;
	};

	const setAuthHeaders = (headers: Headers) => {
		const currentSession = getSession();
		if (!currentSession) {
			return;
		}
		if (currentSession.UID) {
			headers.set("x-pm-uid", currentSession.UID);
		}
		if (currentSession.AccessToken) {
			headers.set("Authorization", `Bearer ${currentSession.AccessToken}`);
		}
		headers.set("x-pm-appversion", APP_VERSION);
	};

	const executeAuthorizedRequest = async (
		input: {
			url: string;
			method: string;
			headers: Headers;
			body?: BodyInit;
			timeoutMs?: number;
			signal?: AbortSignal;
		},
		responseType: "json" | "arrayBuffer",
	): Promise<Response> => {
		const fullUrl = buildUrl(input.url);
		const requestOnce = async () =>
			await requestHttp(
				fullUrl,
				{
					method: input.method,
					headers: input.headers,
					body: input.body,
					timeoutMs: input.timeoutMs,
					signal: input.signal,
				},
				responseType,
			);

		setAuthHeaders(input.headers);
		const initialResponse = await requestOnce();
		const currentSession = getSession();
		if (initialResponse.status !== 401 || !currentSession?.RefreshToken || !onTokenRefresh) {
			return initialResponse;
		}
		try {
			await onTokenRefresh();
			setAuthHeaders(input.headers);
			return await requestOnce();
		} catch {
			return initialResponse;
		}
	};

	return {
		async fetchJson(request: ProtonDriveHTTPClientJsonRequest): Promise<Response> {
			const { url, method, headers, json, timeoutMs, signal } = request;
			return await executeAuthorizedRequest(
				{
					url,
					method,
					headers,
					body: json ? JSON.stringify(json) : undefined,
					timeoutMs,
					signal,
				},
				"json",
			);
		},

		async fetchBlob(request: ProtonDriveHTTPClientBlobRequest): Promise<Response> {
			const { url, method, headers, body, timeoutMs, signal } = request;
			return await executeAuthorizedRequest(
				{
					url,
					method,
					headers,
					body,
					timeoutMs,
					signal,
				},
				"arrayBuffer",
			);
		},
	};
}
