import type { ReusableCredentials, Session } from "./auth-types";

export type AuthSession = {
	session: Session;
	credentials: ReusableCredentials;
	userEmail?: string;
};
