import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { flushEmailOutbox } from "@/lib/utils/server/email-flush";

// Sends email + mutates the outbox — never cache, and allow headroom for the sends.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Shared-secret gate. Configured via FLUSH_SECRET (or CRON_SECRET), sent as `Authorization: Bearer …`
 * by the scheduling GitHub Action. Fails closed in production when unconfigured; in dev it's allowed so
 * local QA can trigger a flush (dev has no RESEND key, so it only console-logs).
 */
function authorized(request: Request): boolean {
	const secret = process.env.FLUSH_SECRET || process.env.CRON_SECRET || "";
	if (!secret) return process.env.NODE_ENV !== "production";
	const header = request.headers.get("authorization") ?? "";
	const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
	const a = Buffer.from(provided);
	const b = Buffer.from(secret);
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
	if (!authorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	try {
		const result = await flushEmailOutbox();
		return NextResponse.json({ ok: true, ...result });
	} catch (err) {
		console.error("POST /api/notifications/flush error:", err);
		return NextResponse.json({ ok: false, error: "Flush failed" }, { status: 500 });
	}
}
