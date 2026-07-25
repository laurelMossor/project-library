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

export function getClientIdentifier(request: Request): string {
	// Try to get IP from headers (works with most proxies)
	const forwarded = request.headers.get("x-forwarded-for");
	const realIp = request.headers.get("x-real-ip");
	const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
	return ip;
}

/**
 * Guard a route handler: derive the client id, check the limit, and return a
 * 429 NextResponse if exceeded (else null to continue). Collapses the
 * getClientIdentifier + checkRateLimit + 429 boilerplate that every rate-limited
 * route repeats. `key` is the limit's logical prefix (the client id is appended).
 *
 * Async by design so a future shared-store backend (Redis/Upstash) can swap in
 * without touching call sites — see rate-limit follow-up ticket.
 */
export async function enforceRateLimit(
	request: Request,
	key: RateLimitKey,
	options: RateLimitOptions,
	message = "Too many requests. Please try again later.",
): Promise<NextResponse | null> {
	const clientId = getClientIdentifier(request);
	const { allowed } = checkRateLimit(`${key}:${clientId}`, options);
	if (!allowed) {
		return NextResponse.json({ error: message }, { status: 429 });
	}
	return null;
}
