// ⚠️ SERVER-ONLY
//
// Lazily-constructed Resend client. Kept behind a getter so importing the email
// module never throws when RESEND_API_KEY is absent (local dev / tests run on
// the console fallback in send.ts). This is the ONLY file that knows about
// Resend specifically — swapping providers later means rewriting send.ts +
// this file, nothing upstream.

import { Resend } from "resend";

let cached: Resend | null = null;

/** Returns a Resend client, or null when no API key is configured. */
export function getResendClient(): Resend | null {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) return null;
	if (!cached) cached = new Resend(apiKey);
	return cached;
}

/**
 * The "From" address. Defaults to Resend's shared sandbox sender, which works
 * with no DNS setup but only delivers to the Resend account owner's inbox.
 * Set EMAIL_FROM to an address on a verified domain for real delivery.
 */
export function getFromAddress(): string {
	return process.env.EMAIL_FROM || "The Project Library <onboarding@resend.dev>";
}
