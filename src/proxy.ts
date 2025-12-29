import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Note: In Next.js 16, middleware.ts is deprecated in favor of proxy.ts
// This file replaces the old middleware.ts pattern

// Routes that require authentication
const protectedRoutes = ["/profile", "/projects/new"];

export default function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Skip proxy for favicon/icon files
	if (
		pathname.startsWith("/favicon") ||
		pathname.startsWith("/icon") ||
		pathname.startsWith("/apple-icon") ||
		pathname === "/manifest.json"
	) {
		return NextResponse.next();
	}

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
		const loginUrl = new URL("/login", req.url);
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

