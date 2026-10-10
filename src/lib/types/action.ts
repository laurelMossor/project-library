/**
 * The one result shape every Server Action returns (client-safe).
 * Actions never throw to the client — failures come back as `{ ok: false }`.
 */
export type ActionError =
	| "unauthorized"
	| "forbidden"
	| "not_found"
	| "invalid"
	| "conflict"
	| "rate_limited"
	| "server";

export type ActionResult<T = void> =
	| { ok: true; data: T }
	| { ok: false; error: ActionError; message?: string };
