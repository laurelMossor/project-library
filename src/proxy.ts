import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PRIVATE_USER_PAGE, USER_PROFILE_SETTINGS, USER_PROFILE_EDIT, PRIVATE_ORG_PAGE, ORG_PROFILE_SETTINGS, ORG_PROFILE_EDIT, PROJECT_NEW, LOGIN, EVENT_NEW, MESSAGES } from "@/lib/const/routes";

// Note: In Next.js 16, middleware.ts is deprecated in favor of proxy.ts
// This file replaces the old middleware.ts pattern

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

export default function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Check if the current path is a protected route
	const isProtected = protectedRoutes.some((route) =>
		pathname.startsWith(route)
	);

	// Check for session cookie (NextAuth v5 uses these cookie names)
	// Also check for any cookie that might be a session cookie
	const sessionCookie = req.cookies.get("authjs.session-token") ||
		req.cookies.get("__Secure-authjs.session-token") ||
		req.cookies.get("next-auth.session-token") ||
		req.cookies.get("__Secure-next-auth.session-token") ||
		// Check for any cookie containing "session" or "auth" in the name
		Array.from(req.cookies.getAll()).some(cookie => 
			cookie.name.includes("session") || cookie.name.includes("auth")
		);

	// If protected and no session cookie, redirect to login
	if (isProtected && !sessionCookie) {
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

