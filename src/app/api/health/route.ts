import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { postCollectionFields, eventCollectionFields } from "@/lib/utils/server/fields";

// Never cache — a stale health check is useless. Every request re-runs the probes live.
export const dynamic = "force-dynamic";

// Required config whose absence means a broken deploy (auth/DB can't work without these).
// We only check presence, never log the values.
const REQUIRED_ENV = ["AUTH_SECRET", "DATABASE_URL", "DIRECT_URL"] as const;

/**
 * Deep health check. This deliberately exercises the REAL read paths the core features
 * depend on — not just connectivity — because the 04/19 outage left the site + DB
 * reachable while the collections (posts/events) query was broken on a missing column.
 * A bare 200 or `SELECT 1` would have passed straight through that incident.
 *
 * All probes are read-only, side-effect-free `findFirst`s (an empty table is healthy —
 * the signal is whether the query executes against the live schema, not whether rows
 * exist). No session/login is created, so this never touches `logAction` or the rate
 * limiter. Returns 200 when everything passes, 503 otherwise.
 */
export async function GET() {
  const checks = {
    config: false,
    db: false,
    posts: false,
    events: false,
    users: false,
  };

  try {
    // 1. Config presence (cheap, no values logged).
    checks.config = REQUIRED_ENV.every((key) => Boolean(process.env[key]));

    // 2. Connectivity gate.
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;

    // 3. Real content read paths — same selects as /explore, so a schema/migration
    //    drift throws here exactly as it would on the collections page.
    await prisma.post.findFirst({ select: postCollectionFields });
    checks.posts = true;

    await prisma.event.findFirst({ select: eventCollectionFields });
    checks.events = true;

    // 4. Auth data path — confirms the User schema is queryable (catches drift like the
    //    Netwerk tokenVersion/emailVerified additions) WITHOUT performing a login.
    await prisma.user.findFirst({ select: { id: true, tokenVersion: true } });
    checks.users = true;

    const ok = Object.values(checks).every(Boolean);
    if (!ok) {
      return NextResponse.json({ status: "error", checks }, { status: 503 });
    }

    return NextResponse.json({
      status: "ok",
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/health error:", error);
    return NextResponse.json(
      {
        status: "error",
        checks,
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 }
    );
  }
}
