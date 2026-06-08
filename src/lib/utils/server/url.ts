// ⚠️ SERVER-ONLY
// Resolves the app's public base URL for building absolute links in emails.
// Mirrors the precedence used by scripts/create-signup-invite.ts.

export function getAppBaseUrl(): string {
	return (
		process.env.APP_BASE_URL ||
		process.env.NEXT_PUBLIC_APP_URL ||
		"http://localhost:3000"
	);
}

/** Build an absolute URL from an app-relative path (e.g. "/verify-email?token=x"). */
export function absoluteUrl(path: string): string {
	return new URL(path, getAppBaseUrl()).toString();
}
