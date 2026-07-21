import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { markContextRead } from "@/lib/utils/server/notification";
import type { NotificationContextKey } from "@/lib/types/notification";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * PATCH /api/notifications/read  body: { context?: "personal" | <pageId> }
 * Mark every unread notification in that identity's bell as read. Scoped to the session user, so it
 * can only ever touch the caller's own rows.
 */
export async function PATCH(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const body = await request.json().catch(() => ({}));
		const context: NotificationContextKey = typeof body?.context === "string" ? body.context : "personal";
		await markContextRead(ctx.userId, context);
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("PATCH /api/notifications/read error:", error);
		return serverError();
	}
}
