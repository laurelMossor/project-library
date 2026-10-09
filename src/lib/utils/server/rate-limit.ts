// ⚠️ SERVER-ONLY: Simple in-memory rate limiting for MVP
// For production, consider using Redis or a dedicated rate limiting service

import { NextResponse } from "next/server";

type RateLimitKey = string;
type RateLimitEntry = {
	count: number;
	resetAt: number;
};

// In-memory store (clears on server restart)
const rateLimitStore = new Map<RateLimitKey, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (entry.resetAt < now) {
			rateLimitStore.delete(key);
		}
	}
}, 60000); // Clean up every minute

export interface RateLimitOptions {
	maxRequests: number;
	windowMs: number;
}

export function checkRateLimit(
	key: RateLimitKey,
	options: RateLimitOptions
): { allowed: boolean; remaining: number; resetAt: number } {
	const now = Date.now();
	const entry = rateLimitStore.get(key);

	if (!entry || entry.resetAt < now) {
		// Create new entry or reset expired entry
		const resetAt = now + options.windowMs;
		rateLimitStore.set(key, { count: 1, resetAt });
		return {
			allowed: true,
			remaining: options.maxRequests - 1,
			resetAt,
		};
	}

	if (entry.count >= options.maxRequests) {
		return {
			allowed: false,
			remaining: 0,
			resetAt: entry.resetAt,
		};
	}

	// Increment count
	entry.count++;
	return {
		allowed: true,
		remaining: options.maxRequests - entry.count,
		resetAt: entry.resetAt,
	};
}

/** Client IP from proxy headers. Takes `Headers` so routes (`request.headers`) and Server Actions (`await headers()`) share it. */
export function getClientIdentifier(headers: Headers): string {
	const forwarded = headers.get("x-forwarded-for");
	const realIp = headers.get("x-real-ip");
	return forwarded?.split(",")[0]?.trim() || realIp || "unknown";
}

/**
 * True when this client is over the limit. `key` is the limit's logical prefix
 * (the client id is appended). The single check behind both enforceRateLimit
 * (routes) and the Server Action wrapper.
 *
 * Async by design so a future shared-store backend (Redis/Upstash) can swap in
 * without touching call sites — see rate-limit follow-up ticket.
 */
export async function isRateLimited(
	headers: Headers,
	key: RateLimitKey,
	options: RateLimitOptions,
): Promise<boolean> {
	return !checkRateLimit(`${key}:${getClientIdentifier(headers)}`, options).allowed;
}

/** Route adapter: a 429 NextResponse if exceeded, else null to continue. */
export async function enforceRateLimit(
	request: Request,
	key: RateLimitKey,
	options: RateLimitOptions,
	message = "Too many requests. Please try again later.",
): Promise<NextResponse | null> {
	if (await isRateLimited(request.headers, key, options)) {
		return NextResponse.json({ error: message }, { status: 429 });
	}
	return null;
}
