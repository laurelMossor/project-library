import { NextResponse } from "next/server";
import { NotificationCategory } from "@prisma/client";
import { getSessionContext } from "@/lib/utils/server/session";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import {
	getEffectivePrefs,
	setMaster,
	setPref,
	type EmailIdentity,
} from "@/lib/utils/server/notification-preferences";

/**
 * Resolve the email-preference identity for the current request: the session user's personal profile,
 * or — when acting as a page — that page (which the user must manage: ADMIN/EDITOR). Preferences are
 * per (user, context), so a page's rows belong to *this* manager, independent of other managers.
 */
async function activeIdentity(): Promise<{ identity: EmailIdentity } | { error: NextResponse }> {
	const ctx = await getSessionContext();
	if (!ctx) return { error: unauthorized() };
	if (ctx.activePageId) {
		const allowed = await canPostAsPage(ctx.userId, ctx.activePageId);
		if (!allowed) return { error: NextResponse.json({ error: "You don't manage this page" }, { status: 403 }) };
	}
	return { identity: { recipientUserId: ctx.userId, contextPageId: ctx.activePageId } };
}

const CATEGORIES = new Set<string>(Object.values(NotificationCategory));

/** GET the active identity's effective email preferences ({ master, categories }). */
export async function GET() {
	const resolved = await activeIdentity();
	if ("error" in resolved) return resolved.error;
	return NextResponse.json(await getEffectivePrefs(resolved.identity));
}

/** PUT { master?: boolean, categories?: Partial<Record<Category, boolean>> } for the active identity. */
export async function PUT(request: Request) {
	const resolved = await activeIdentity();
	if ("error" in resolved) return resolved.error;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return badRequest("Request body must be valid JSON");
	}
	const { master, categories } = (body ?? {}) as { master?: unknown; categories?: unknown };

	if (master !== undefined) {
		if (typeof master !== "boolean") return badRequest("`master` must be a boolean");
		await setMaster(resolved.identity, master);
	}
	if (categories !== undefined) {
		if (typeof categories !== "object" || categories === null) return badRequest("`categories` must be an object");
		for (const [cat, value] of Object.entries(categories)) {
			if (!CATEGORIES.has(cat)) return badRequest(`Unknown category: ${cat}`);
			if (typeof value !== "boolean") return badRequest(`Category ${cat} must be a boolean`);
			await setPref(resolved.identity, cat as NotificationCategory, value);
		}
	}

	return NextResponse.json(await getEffectivePrefs(resolved.identity));
}
