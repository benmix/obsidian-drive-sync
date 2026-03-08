export type NetworkDecision =
	| { allowed: true }
	| { allowed: false; reason: string; retryAfterMs?: number };
