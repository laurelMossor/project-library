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

// ── Maintenance gate ────────────────────────────────────────────────────────
// Flip ON by setting MAINTENANCE_MODE=1 in the environment (Vercel → Settings →
// Environment Variables → Production) and redeploying; flip OFF by setting it back
// to 0 and redeploying. When ON, every matched request is answered with a
// self-contained 503 page from the edge — the Next render pipeline never runs, so
// this holds even while a schema migration is mid-flight and the app would 500.
// (The matcher below already excludes /api, so /api/health stays reachable.)
//
// Operator bypass: load any URL once with ?maint_bypass=<MAINTENANCE_BYPASS_TOKEN>.
// That sets an httpOnly cookie; you then browse the real (new) site to verify it
// while the public still sees the pause. Flip maintenance off once you're happy.
const BYPASS_COOKIE = "maint_bypass";

function maintenanceResponse(): NextResponse {
	return new NextResponse(MAINTENANCE_HTML, {
		status: 503,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"retry-after": "300",
			"cache-control": "no-store",
		},
	});
}

export default function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Maintenance gate runs first and cheapest.
	if (process.env.MAINTENANCE_MODE === "1") {
		const token = process.env.MAINTENANCE_BYPASS_TOKEN;
		const bypassed = !!token && req.cookies.get(BYPASS_COOKIE)?.value === token;
		if (!bypassed) {
			// First bypass hit carries the token in the query → set a sticky cookie and let it through.
			if (token && req.nextUrl.searchParams.get("maint_bypass") === token) {
				const res = NextResponse.next();
				res.cookies.set(BYPASS_COOKIE, token, {
					httpOnly: true,
					sameSite: "lax",
					path: "/",
					maxAge: 60 * 60 * 2, // 2h — long enough for a cutover
				});
				return res;
			}
			return maintenanceResponse();
		}
		// bypassed → fall through to normal proxy behavior below
	}

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
	// redirect that later bounces a legitimately logged-in user. Because this skip
	// exists, every protected page MUST keep its own server-side auth guard
	// (auth() + redirect / AuthError); this edge check is defense-in-depth only.
	const isPrefetch =
		req.headers.get("next-router-prefetch") === "1" ||
		req.headers.get("rsc") === "1" ||
		req.headers.get("purpose") === "prefetch";

	if (isProtected && !isPrefetch && !hasSessionCookie(req)) {
		// Debug aid (cookie names on an unauthenticated hit) — gated so it doesn't
		// write a JSON line per bot/crawler request to a protected path.
		if (process.env.PROXY_DEBUG === "true") {
			console.log(
				JSON.stringify({
					type: "auth_redirect",
					path: pathname,
					cookiesPresent: req.cookies.getAll().map((c) => c.name),
					ts: new Date().toISOString(),
				})
			);
		}
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

const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Maintenance | The Project Library</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #E6E8E6;
    color: #291F1E;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .card {
    max-width: 30rem; width: 100%; text-align: center;
    background: #ffffff; border: 1px solid #CED0CE; border-radius: 16px;
    padding: 48px 32px; box-shadow: 0 8px 30px rgba(41, 31, 30, 0.08);
  }
  h1 { font-size: 1.75rem; margin: 0 0 12px; color: #291F1E; }
  p { color: #3F403F; line-height: 1.6; margin: 0; }
</style>
</head>
<body>
  <main class="card" role="main">
    <h1>Down for maintenance</h1>
    <p>The Project Library is temporarily offline for a scheduled update. Please check back in a few minutes.</p>
  </main>
</body>
</html>`;
