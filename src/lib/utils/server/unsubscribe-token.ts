// ⚠️ SERVER-ONLY: stateless unsubscribe tokens.
//
// A signed (not stored) token identifying the email identity `{recipientUserId, contextPageId}`. Stored
// one-time tokens (auth-tokens.ts) can't be used here: email link-scanners PREFETCH links and would burn
// a one-time token before the human clicks. An HMAC token is idempotent — verifying it changes nothing —
// so a prefetch is harmless, and the mutation happens only on a deliberate confirm POST.

import { createHmac, timingSafeEqual } from "node:crypto";

// Dedicated secret for key separation; falls back to the app's auth secret (AUTH_SECRET, NextAuth v5;
// NEXTAUTH_SECRET for older setups) so dev/test/prod work without new config. Set a dedicated
// UNSUBSCRIBE_SECRET in prod for key separation — but once chosen, keep it STABLE: changing it
// invalidates the unsubscribe links in every already-sent email.
const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

export type UnsubscribeTarget = { recipientUserId: string; contextPageId: string | null };

function sign(payload: string): string {
	return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Build a `<payload>.<sig>` token for one identity's email master. */
export function signUnsubscribeToken(target: UnsubscribeTarget): string {
	const payload = Buffer.from(
		JSON.stringify({ u: target.recipientUserId, p: target.contextPageId ?? null }),
	).toString("base64url");
	return `${payload}.${sign(payload)}`;
}

/** Verify + decode a token; returns the target, or null if malformed/tampered/unconfigured. */
export function verifyUnsubscribeToken(token: string): UnsubscribeTarget | null {
	if (!SECRET) return null;
	const dot = token.lastIndexOf(".");
	if (dot <= 0) return null;
	const payload = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const expected = sign(payload);
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	try {
		const obj = JSON.parse(Buffer.from(payload, "base64url").toString());
		if (typeof obj.u !== "string") return null;
		return { recipientUserId: obj.u, contextPageId: typeof obj.p === "string" ? obj.p : null };
	} catch {
		return null;
	}
}
