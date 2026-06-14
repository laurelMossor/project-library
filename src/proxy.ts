import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PAGE_NEW, LOGIN, EVENT_NEW, MESSAGES, SETTINGS, CONNECTIONS } from "@/lib/const/routes";

// Next.js 16: proxy.ts replaces the deprecated middleware.ts
// Keep this lightweight - only handle redirects, rewrites, and headers

// Routes that require authentication.
const protectedRoutes = [
	PAGE_NEW,
	EVENT_NEW,
	MESSAGES,
	SETTINGS,
	"/settings/personal-info",
	CONNECTIONS,
];

// Session cookie name prefixes used by Auth.js / NextAuth.
// Auth.js can split large JWTs into chunks named e.g. authjs.session-token.0,
// so we match by prefix rather than exact name.
const SESSION_COOKIE_PREFIXES = [
	"authjs.session-token",
	"__Secure-authjs.session-token",
	"next-auth.session-token",
	"__Secure-next-auth.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
	const cookieNames = req.cookies.getAll().map((c) => c.name);
	return SESSION_COOKIE_PREFIXES.some((prefix) =>
		cookieNames.some((name) => name === prefix || name.startsWith(prefix + "."))
	);
}

export default function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;

	const ip =
		req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		req.headers.get("x-real-ip") ??
		"unknown";

	console.log(
		JSON.stringify({
			type: "request",
			method: req.method,
			path: pathname,
			ip,
			referer: req.headers.get("referer") ?? null,
			ua: req.headers.get("user-agent") ?? null,
			ts: new Date().toISOString(),
		})
	);

	// Check if the current path is a protected route
	const isProtected = protectedRoutes.some((route) =>
		pathname.startsWith(route)
	);

	// If protected and no session cookie, redirect to login.
	// Skip the redirect for prefetch / RSC requests — a prefetch can be issued
	// before the browser sends cookies, so redirecting here would cache a stale
	// redirect that later bounces a legitimately logged-in user.
	const isPrefetch =
		req.headers.get("next-router-prefetch") === "1" ||
		req.headers.get("rsc") === "1" ||
		req.headers.get("purpose") === "prefetch";

	if (isProtected && !isPrefetch && !hasSessionCookie(req)) {
		const cookiesPresent = req.cookies.getAll().map((c) => c.name);
		console.log(
			JSON.stringify({
				type: "auth_redirect",
				path: pathname,
				cookiesPresent,
				ts: new Date().toISOString(),
			})
		);
		const loginUrl = new URL(LOGIN, req.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

// Run proxy on all routes except static files and api
export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, favicon.png (favicon files)
		 * - icon.png, icon.ico (icon files)
		 * - apple-icon.png (Apple touch icons)
		 * - manifest.json (web manifest)
		 */
		"/((?!api|_next/static|_next/image|favicon|icon|apple-icon|manifest).*)",
	],
};
