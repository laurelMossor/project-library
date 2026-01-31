import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PRIVATE_USER_PAGE, USER_PROFILE_SETTINGS, USER_PROFILE_EDIT, PRIVATE_ORG_PAGE, ORG_PROFILE_SETTINGS, ORG_PROFILE_EDIT, PROJECT_NEW, LOGIN, EVENT_NEW, MESSAGES } from "@/lib/const/routes";

// Next.js 16: proxy.ts replaces the deprecated middleware.ts
// Keep this lightweight - only handle redirects, rewrites, and headers

// Routes that require authentication
const protectedRoutes = [
	PRIVATE_USER_PAGE,
	USER_PROFILE_SETTINGS,
	USER_PROFILE_EDIT,
	PRIVATE_ORG_PAGE,
	ORG_PROFILE_SETTINGS,
	ORG_PROFILE_EDIT,
	PROJECT_NEW,
	EVENT_NEW,
	MESSAGES,
];

// Session cookie names used by Auth.js / NextAuth
const SESSION_COOKIE_NAMES = [
	"authjs.session-token",
	"__Secure-authjs.session-token",
	"next-auth.session-token",
	"__Secure-next-auth.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
	return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

export default function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Check if the current path is a protected route
	const isProtected = protectedRoutes.some((route) =>
		pathname.startsWith(route)
	);

	// If protected and no session cookie, redirect to login
	if (isProtected && !hasSessionCookie(req)) {
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

