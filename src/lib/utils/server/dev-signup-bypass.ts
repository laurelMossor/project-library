// ⚠️ SERVER-ONLY

import { timingSafeEqual } from "node:crypto";

/**
 * When `NODE_ENV === "development"` and `DEV_SIGNUP_BYPASS_SECRET` is set (≥20 chars),
 * signup may use that exact string as the `invite` value to skip DB invites.
 * Never enabled in production (`next build` / Vercel use NODE_ENV=production).
 */
export function isDevSignupBypassToken(invite: string): boolean {
	if (process.env.NODE_ENV !== "development") return false;
	const secret = process.env.DEV_SIGNUP_BYPASS_SECRET?.trim();
	if (!secret || secret.length < 20) return false;
	const a = Buffer.from(invite, "utf8");
	const b = Buffer.from(secret, "utf8");
	if (a.length !== b.length) return false;
	try {
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}
