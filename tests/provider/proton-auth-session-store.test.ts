import { describe, expect, test } from "vitest";

import { ProtonAuthSessionStore } from "../../src/provider/providers/proton-drive/sdk/proton-auth/core/session-store";

describe("ProtonAuthSessionStore", () => {
	test("tracks pending two-factor challenges explicitly", () => {
		const store = new ProtonAuthSessionStore();
		store.beginTwoFactorChallenge(
			{
				UID: "child-uid",
				AccessToken: "child-access",
				RefreshToken: "child-refresh",
				passwordMode: 1,
			},
			"login-password",
			{
				UID: "child-uid",
				AccessToken: "child-access",
				RefreshToken: "child-refresh",
				UserID: "user-1",
				Scope: "scope",
				ServerProof: "proof",
				Code: 1000,
			},
		);

		expect(store.getState()).toMatchObject({
			kind: "pending_two_factor",
			loginPassword: "login-password",
		});
		expect(store.getSession()).toMatchObject({
			UID: "child-uid",
		});
		expect(store.getParentSession()).toBeNull();
	});

	test("keeps parent and child sessions separate once authenticated", () => {
		const store = new ProtonAuthSessionStore();
		store.setAuthenticated({
			parentSession: {
				UID: "parent-uid",
				AccessToken: "parent-access",
				RefreshToken: "parent-refresh",
			},
			childSession: {
				UID: "child-uid",
				AccessToken: "child-access",
				RefreshToken: "child-refresh",
			},
		});

		expect(store.getState()).toEqual({
			kind: "authenticated",
			parentSession: {
				UID: "parent-uid",
				AccessToken: "parent-access",
				RefreshToken: "parent-refresh",
			},
			childSession: {
				UID: "child-uid",
				AccessToken: "child-access",
				RefreshToken: "child-refresh",
			},
		});
		expect(store.getSession()).toMatchObject({ UID: "child-uid" });
		expect(store.getParentSession()).toMatchObject({ UID: "parent-uid" });
	});
});
