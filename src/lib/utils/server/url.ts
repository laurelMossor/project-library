// ⚠️ SERVER-ONLY
// Resolves the app's public base URL for building absolute links in emails.
// Mirrors the precedence used by scripts/create-signup-invite.ts.

export function getAppBaseUrl(): string {
	// Explicit override wins — set APP_BASE_URL (server) or NEXT_PUBLIC_APP_URL
	// (build-time) to the canonical public origin, e.g. https://www.theprojectlibrary.com.
	if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
	if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
	// Safety net on Vercel so prod links can never silently fall through to
	// localhost when the explicit vars are unset (the cause of the localhost
	// verification links). VERCEL_PROJECT_PRODUCTION_URL is the stable production
	// domain, VERCEL_URL the per-deployment host — both are host-only, no protocol.
	const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
	if (vercelHost) return `https://${vercelHost}`;
	return "http://localhost:3000";
}

/** Build an absolute URL from an app-relative path (e.g. "/verify-email?token=x"). */
export function absoluteUrl(path: string): string {
	return new URL(path, getAppBaseUrl()).toString();
}
