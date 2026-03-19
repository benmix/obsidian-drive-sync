import type { AuthResponse, Session, TwoFAInfo } from "@contracts/provider/proton/auth-types";
import { createProtonAuthError } from "@provider/providers/proton-drive/sdk/auth-errors";
import type {
	AuthenticatedSessions,
	AuthState,
} from "@provider/providers/proton-drive/sdk/auth-state";

export class ProtonAuthSessionStore {
	private state: AuthState = { kind: "idle" };

	getState(): AuthState {
		return this.state;
	}

	getSession(): Session | null {
		switch (this.state.kind) {
			case "pending_two_factor":
			case "pending_mailbox_password":
				return this.state.session;
			case "authenticated":
				return this.state.childSession;
			case "idle":
			default:
				return null;
		}
	}

	getParentSession(): Session | null {
		switch (this.state.kind) {
			case "pending_mailbox_password":
				return this.state.parentSession;
			case "authenticated":
				return this.state.parentSession;
			case "pending_two_factor":
			case "idle":
			default:
				return null;
		}
	}

	beginTwoFactorChallenge(
		session: Session,
		loginPassword: string,
		authResponse: AuthResponse,
		twoFactorInfo?: TwoFAInfo,
	): void {
		this.state = {
			kind: "pending_two_factor",
			session,
			loginPassword,
			authResponse,
			twoFactorInfo,
		};
	}

	beginMailboxPasswordChallenge(parentSession: Session, session?: Session): void {
		this.state = {
			kind: "pending_mailbox_password",
			parentSession,
			session: session ?? { ...parentSession },
		};
	}

	setAuthenticated(sessions: AuthenticatedSessions): void {
		this.state = {
			kind: "authenticated",
			parentSession: sessions.parentSession,
			childSession: sessions.childSession,
		};
	}

	updateAuthenticatedChildSession(childSession: Session): void {
		const authenticated = this.requireAuthenticatedState();
		this.state = {
			kind: "authenticated",
			parentSession: authenticated.parentSession,
			childSession,
		};
	}

	updateAuthenticatedParentSession(parentSession: Session): void {
		const authenticated = this.requireAuthenticatedState();
		this.state = {
			kind: "authenticated",
			parentSession,
			childSession: authenticated.childSession,
		};
	}

	clear(): void {
		this.state = { kind: "idle" };
	}

	requirePendingTwoFactorState(): Extract<AuthState, { kind: "pending_two_factor" }> {
		if (this.state.kind !== "pending_two_factor") {
			throw createProtonAuthError("invalid_state", {
				message: "No pending two-factor authentication.",
			});
		}
		return this.state;
	}

	requirePendingMailboxPasswordState(): Extract<AuthState, { kind: "pending_mailbox_password" }> {
		if (this.state.kind !== "pending_mailbox_password") {
			throw createProtonAuthError("invalid_state", {
				message: "Mailbox password is not currently required.",
			});
		}
		return this.state;
	}

	requireAuthenticatedState(): Extract<AuthState, { kind: "authenticated" }> {
		if (this.state.kind !== "authenticated") {
			throw createProtonAuthError("invalid_state", {
				message: "Authentication is incomplete.",
			});
		}
		return this.state;
	}
}
