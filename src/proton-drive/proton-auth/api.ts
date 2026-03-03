import { API_BASE_URL, APP_VERSION } from "./types";
import type { ApiError, ApiResponse, Session } from "./types";
import { requestHttp } from "./http";

// ============================================================================
// HTTP Client
// ============================================================================

/**
 * Create headers for API requests
 */
export function createHeaders(session: Session | null = null): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"x-pm-appversion": APP_VERSION,
	};
	if (session?.UID) {
		headers["x-pm-uid"] = session.UID;
	}
	if (session?.AccessToken) {
		headers["Authorization"] = `Bearer ${session.AccessToken}`;
	}
	return headers;
}

/**
 * Make API request
 */
export async function apiRequest<T extends ApiResponse>(
	method: string,
	endpoint: string,
	data: Record<string, unknown> | null = null,
	session: Session | null = null,
): Promise<T> {
	const url = `${API_BASE_URL}/${endpoint}`;
	const options: RequestInit = {
		method,
		headers: createHeaders(session),
	};
	if (data) {
		options.body = JSON.stringify(data);
	}

	const response = await requestHttp(
		url,
		{
			method,
			headers: options.headers,
			body: options.body ?? undefined,
		},
		"json",
	);
	const json = (await response.json()) as T;

	if (!response.ok || json.Code !== 1000) {
		const error = new Error(json.Error || `API error: ${response.status}`) as ApiError;
		error.code = json.Code;
		error.response = json;
		error.status = response.status;
		throw error;
	}

	return json;
}
