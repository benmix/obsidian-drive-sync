import type {
	Address,
	AuthResponse,
	KeySalt,
	Session,
	TwoFAInfo,
	User,
} from "../../../../../../contracts/provider/proton/auth-types";

export type ProtonBootstrapData = {
	user: User;
	keySalts: KeySalt[];
	addresses: Address[];
};

export type ProtonRestoreBootstrapData = {
	user: User;
	addresses: Address[];
};

export type AuthenticatedSessions = {
	parentSession: Session;
	childSession: Session;
};

export type AuthState =
	| { kind: "idle" }
	| {
			kind: "pending_two_factor";
			session: Session;
			loginPassword: string;
			twoFactorInfo?: TwoFAInfo;
			authResponse: AuthResponse;
	  }
	| {
			kind: "pending_mailbox_password";
			parentSession: Session;
			session: Session;
	  }
	| ({
			kind: "authenticated";
	  } & AuthenticatedSessions);
