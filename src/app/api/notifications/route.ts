import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { getNotificationsForUser } from "@/lib/utils/server/notification";
import type { NotificationContextKey } from "@/lib/types/notification";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * GET /api/notifications?context=personal|<pageId>
 * The latest notifications for the given identity's bell, hydrated with actor + a precomputed href.
 * Scoped to the session user: `recipientUserId = session.userId`, so an arbitrary `context` can
 * never surface another user's rows (worst case, an empty list).
 */
export async function GET(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const context = (new URL(request.url).searchParams.get("context") ?? "personal") as NotificationContextKey;
		const items = await getNotificationsForUser(ctx.userId, context);
		return NextResponse.json({ items });
	} catch (error) {
		console.error("GET /api/notifications error:", error);
		return serverError();
	}
}
