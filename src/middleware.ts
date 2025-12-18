import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/profile"];

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Check if the current path is a protected route
	const isProtected = protectedRoutes.some((route) =>
		pathname.startsWith(route)
	);

	// Check for session cookie (NextAuth stores session in this cookie)
	const sessionCookie = req.cookies.get("authjs.session-token") ||
		req.cookies.get("__Secure-authjs.session-token");

	// If protected and no session cookie, redirect to login
	if (isProtected && !sessionCookie) {
		const loginUrl = new URL("/login", req.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

// Run middleware on all routes except static files and api
export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
