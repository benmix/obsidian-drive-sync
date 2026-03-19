import type { ReusableCredentials, Session } from "@contracts/provider/proton/auth-types";

export type AuthSession = {
	session: Session;
	credentials: ReusableCredentials;
	userEmail?: string;
};
