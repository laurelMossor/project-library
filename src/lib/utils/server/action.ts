// ⚠️ SERVER-ONLY: the one entrypoint every Server Action is built on.
//
// A `"use server"` file exports `authedAction(...)` / `publicAction(...)` results.
// The wrapper owns the cross-cutting steps, so an action body is only
// "check input → call the server util":
//   session → rate limit → handler → DomainError mapping → refresh()
//
// Server Actions are public HTTP endpoints: anyone can call them with any
// arguments. Handlers validate their input and throw DomainError to refuse.

import { headers } from "next/headers";
import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/types/action";
import { getSessionContext, type SessionContext } from "./session";
import { isRateLimited, type RateLimitOptions } from "./rate-limit";
import { DomainError } from "./domain-error";

type ActionOptions = {
	/** Per-client limit. `key` is the limit's name (e.g. "comment-create"). */
	rateLimit?: { key: string } & RateLimitOptions;
	/**
	 * Re-render the current page from the server after success (default true),
	 * so every server-rendered value on screen reflects the change.
	 */
	refresh?: boolean;
};

async function run<C, I, O>(
	ctx: C,
	input: I,
	handler: (ctx: C, input: I) => Promise<O>,
	options: ActionOptions,
): Promise<ActionResult<O>> {
	try {
		if (options.rateLimit) {
			const { key, ...limit } = options.rateLimit;
			if (await isRateLimited(await headers(), key, limit)) {
				return { ok: false, error: "rate_limited", message: "Too many requests. Please try again later." };
			}
		}
		const data = await handler(ctx, input);
		if (options.refresh !== false) refresh();
		return { ok: true, data };
	} catch (err) {
		if (err instanceof DomainError) return { ok: false, error: err.code, message: err.message };
		console.error("[action] unexpected error:", err);
		return { ok: false, error: "server", message: "Something went wrong. Please try again." };
	}
}

/** An action that requires a signed-in user. */
export function authedAction<I, O = void>(
	handler: (ctx: SessionContext, input: I) => Promise<O>,
	options: ActionOptions = {},
): (input: I) => Promise<ActionResult<O>> {
	return async (input) => {
		const ctx = await getSessionContext();
		if (!ctx) return { ok: false, error: "unauthorized", message: "Please log in to continue." };
		return run(ctx, input, handler, options);
	};
}

/** An action anyone may call (signed in or not), e.g. an RSVP or an auth flow. */
export function publicAction<I, O = void>(
	handler: (ctx: SessionContext | null, input: I) => Promise<O>,
	options: ActionOptions = {},
): (input: I) => Promise<ActionResult<O>> {
	return async (input) => run(await getSessionContext(), input, handler, options);
}
