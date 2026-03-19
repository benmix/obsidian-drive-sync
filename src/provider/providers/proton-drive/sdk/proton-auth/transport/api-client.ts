import type {
	Address,
	ApiError,
	ApiResponse,
	AuthInfo,
	AuthResponse,
	KeySalt,
	PullForkResponse,
	PushForkResponse,
	Session,
	User,
} from "@contracts/provider/proton/auth-types";
import {
	API_BASE_URL,
	APP_VERSION,
	CHILD_CLIENT_ID,
	INVALID_REFRESH_TOKEN_CODE,
} from "@contracts/provider/proton/auth-types";
import {
	apiRequest,
	createHeaders,
} from "@provider/providers/proton-drive/sdk/proton-auth/transport/api";
import { requestHttp } from "@provider/providers/proton-drive/sdk/proton-auth/transport/http";

export class ProtonAuthApiClient {
	async getAuthInfo(username: string): Promise<AuthInfo & ApiResponse> {
		return await apiRequest<AuthInfo & ApiResponse>("POST", "core/v4/auth/info", {
			Username: username,
		});
	}

	async authenticate(authData: Record<string, unknown>): Promise<AuthResponse> {
		return await apiRequest<AuthResponse>("POST", "core/v4/auth", authData);
	}

	async submitTwoFactor(
		code: string,
		session: Session,
	): Promise<ApiResponse & { AccessToken?: string; RefreshToken?: string }> {
		return await apiRequest<ApiResponse & { AccessToken?: string; RefreshToken?: string }>(
			"POST",
			"core/v4/auth/2fa",
			{ TwoFactorCode: code },
			session,
		);
	}

	async getUser(session: Session): Promise<User> {
		const response = await apiRequest<ApiResponse & { User: User }>(
			"GET",
			"core/v4/users",
			null,
			session,
		);
		return response.User;
	}

	async getUserWithRefresh(
		getSession: () => Session | null,
		refreshSession: () => Promise<void>,
	): Promise<User> {
		const response = await this.apiRequestWithRefresh<ApiResponse & { User: User }>(
			getSession,
			refreshSession,
			"GET",
			"core/v4/users",
		);
		return response.User;
	}

	async getKeySalts(session: Session): Promise<KeySalt[]> {
		const response = await apiRequest<ApiResponse & { KeySalts?: KeySalt[] }>(
			"GET",
			"core/v4/keys/salts",
			null,
			session,
		);
		return response.KeySalts || [];
	}

	async getAddresses(session: Session): Promise<Address[]> {
		const response = await apiRequest<ApiResponse & { Addresses?: Address[] }>(
			"GET",
			"core/v4/addresses",
			null,
			session,
		);
		return response.Addresses || [];
	}

	async getAddressesWithRefresh(
		getSession: () => Session | null,
		refreshSession: () => Promise<void>,
	): Promise<Address[]> {
		const response = await this.apiRequestWithRefresh<ApiResponse & { Addresses?: Address[] }>(
			getSession,
			refreshSession,
			"GET",
			"core/v4/addresses",
		);
		return response.Addresses || [];
	}

	async refreshTokens(
		uid: string,
		refreshToken: string,
	): Promise<{ accessToken: string; refreshToken: string }> {
		const response = await requestHttp(
			`${API_BASE_URL}/auth/refresh`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-pm-appversion": APP_VERSION,
					"x-pm-uid": uid,
				},
				body: JSON.stringify({
					ResponseType: "token",
					GrantType: "refresh_token",
					RefreshToken: refreshToken,
					RedirectURI: "https://protonmail.com",
				}),
			},
			"json",
		);

		const json = (await response.json()) as ApiResponse & {
			AccessToken?: string;
			RefreshToken?: string;
		};

		if (!response.ok || json.Code !== 1000) {
			const error = new Error(json.Error || "Token refresh failed") as ApiError;
			error.code = json.Code;
			error.response = json;
			error.status = response.status;
			throw error;
		}

		if (!json.AccessToken || !json.RefreshToken) {
			throw new Error("Token refresh response missing tokens");
		}

		return {
			accessToken: json.AccessToken,
			refreshToken: json.RefreshToken,
		};
	}

	async pushForkSession(parentSession: Session, payload: string): Promise<PushForkResponse> {
		const response = await requestHttp(
			`${API_BASE_URL}/auth/v4/sessions/forks`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-pm-appversion": APP_VERSION,
					"x-pm-uid": parentSession.UID,
					Authorization: `Bearer ${parentSession.AccessToken}`,
				},
				body: JSON.stringify({
					Payload: payload,
					ChildClientID: CHILD_CLIENT_ID,
					Independent: 0,
				}),
			},
			"json",
		);

		const json = (await response.json()) as ApiResponse & PushForkResponse;
		if (!response.ok || json.Code !== 1000) {
			const error = new Error(json.Error || "Failed to push fork session") as ApiError;
			error.code = json.Code;
			error.response = json;
			error.status = response.status;
			throw error;
		}

		if (!json.Selector) {
			throw new Error("Fork response missing Selector");
		}

		return json;
	}

	async pullForkSession(selector: string, parentSession: Session): Promise<PullForkResponse> {
		const response = await requestHttp(
			`${API_BASE_URL}/auth/v4/sessions/forks/${selector}`,
			{
				method: "GET",
				headers: {
					"x-pm-appversion": APP_VERSION,
					"x-pm-uid": parentSession.UID,
					Authorization: `Bearer ${parentSession.AccessToken}`,
				},
			},
			"json",
		);

		const json = (await response.json()) as ApiResponse & PullForkResponse;
		if (!response.ok || json.Code !== 1000) {
			const error = new Error(json.Error || "Failed to pull fork session") as ApiError;
			error.code = json.Code;
			error.response = json;
			error.status = response.status;
			throw error;
		}

		if (!json.UID || !json.AccessToken || !json.RefreshToken) {
			throw new Error("Fork response missing required session data");
		}

		return json;
	}

	async revokeSession(session: Session): Promise<void> {
		await requestHttp(
			`${API_BASE_URL}/core/v4/auth`,
			{
				method: "DELETE",
				headers: createHeaders(session),
			},
			"json",
		);
	}

	private async apiRequestWithRefresh<T extends ApiResponse>(
		getSession: () => Session | null,
		refreshSession: () => Promise<void>,
		method: string,
		endpoint: string,
		data: Record<string, unknown> | null = null,
	): Promise<T> {
		const session = getSession();
		if (!session) {
			throw new Error("No session available");
		}
		try {
			return await apiRequest<T>(method, endpoint, data, session);
		} catch (error) {
			const apiError = error as ApiError;
			const errorCode =
				typeof apiError?.code === "number"
					? apiError.code
					: typeof apiError?.response?.Code === "number"
						? apiError.response.Code
						: undefined;
			if (
				(apiError.status === 401 || errorCode === INVALID_REFRESH_TOKEN_CODE) &&
				session.RefreshToken
			) {
				await refreshSession();
				const refreshed = getSession();
				if (!refreshed) {
					throw new Error("No refreshed session available");
				}
				return await apiRequest<T>(method, endpoint, data, refreshed);
			}
			throw error;
		}
	}
}
