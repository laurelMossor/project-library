// ⚠️ SERVER-ONLY: Simple in-memory rate limiting for MVP
// For production, consider using Redis or a dedicated rate limiting service

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
