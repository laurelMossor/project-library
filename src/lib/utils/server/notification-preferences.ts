// ⚠️ SERVER-ONLY: Email notification preference resolution + CRUD.
//
// The single home for "does user U want category C emails for context X?" — consumed by both the flush
// (batched `resolveEmailPrefs`) and the settings API (`getEffectivePrefs` / `setMaster` / `setPref`), so
// the "stored row ?? default" rule lives in exactly one place.
//
// Preferences are per (user, context): `userId` is always the human; `contextPageId` is null for their
// personal profile, else a page they manage — so each manager of a page has their OWN rows. A row with
// `category` set is that category's on/off; a row with `category` NULL is the per-context master (default
// on). A missing category row falls back to CATEGORY_EMAIL_DEFAULT.

import { NotificationCategory } from "@prisma/client";
import { prisma } from "./prisma";
import { CATEGORY_EMAIL_DEFAULT } from "./notification-category";

/**
 * A delivery/preference identity. Mail lands at `recipientUserId`'s address; `contextPageId` (null = the
 * user's personal profile, else a page they manage) selects which of the user's contexts governs.
 */
export type EmailIdentity = { recipientUserId: string; contextPageId: string | null };

/** Stable key for a (user, context) pair. */
function contextKey(userId: string, contextPageId: string | null): string {
	return `${userId}|${contextPageId ?? ""}`;
}

/** The decision-map key for one (identity, category). Exported so callers can look up their rows. */
export function prefDecisionKey(id: EmailIdentity, category: NotificationCategory): string {
	return `${contextKey(id.recipientUserId, id.contextPageId)}|${category}`;
}

/**
 * Batched preference resolution for the flush: given (identity, category) items, return a map from
 * `prefDecisionKey` → effective on/off. One query over the recipients' rows; effective = per-context
 * master (row with category NULL, default on) AND (category row ?? CATEGORY_EMAIL_DEFAULT). Keeps N
 * pending rows at O(1) queries.
 */
export async function resolveEmailPrefs(
	items: (EmailIdentity & { category: NotificationCategory })[],
): Promise<Map<string, boolean>> {
	const decision = new Map<string, boolean>();
	if (items.length === 0) return decision;

	const userIds = [...new Set(items.map((i) => i.recipientUserId))];
	const rows = await prisma.notificationPreference.findMany({
		where: { userId: { in: userIds } },
		select: { userId: true, contextPageId: true, category: true, enabled: true },
	});

	const masterMap = new Map<string, boolean>(); // (user, context) → master enabled
	const catMap = new Map<string, boolean>(); // (user, context, category) → enabled
	for (const r of rows) {
		const ctx = contextKey(r.userId, r.contextPageId);
		if (r.category === null) masterMap.set(ctx, r.enabled);
		else catMap.set(`${ctx}|${r.category}`, r.enabled);
	}

	for (const item of items) {
		const ctx = contextKey(item.recipientUserId, item.contextPageId);
		const master = masterMap.get(ctx) ?? true;
		const catEnabled = catMap.get(`${ctx}|${item.category}`) ?? CATEGORY_EMAIL_DEFAULT[item.category];
		decision.set(prefDecisionKey(item, item.category), master && catEnabled);
	}
	return decision;
}

/** The full effective preference set for one identity — master + every category (row ?? default). */
export async function getEffectivePrefs(
	id: EmailIdentity,
): Promise<{ master: boolean; categories: Record<NotificationCategory, boolean> }> {
	const rows = await prisma.notificationPreference.findMany({
		where: { userId: id.recipientUserId, contextPageId: id.contextPageId },
		select: { category: true, enabled: true },
	});
	const stored = new Map(rows.filter((r) => r.category !== null).map((r) => [r.category!, r.enabled]));
	const master = rows.find((r) => r.category === null)?.enabled ?? true;
	const categories = {} as Record<NotificationCategory, boolean>;
	for (const cat of Object.values(NotificationCategory)) {
		categories[cat] = stored.get(cat) ?? CATEGORY_EMAIL_DEFAULT[cat];
	}
	return { master, categories };
}

/**
 * Write one preference row for an identity (category = a NotificationCategory, or null for the master).
 * Find-then-write inside a transaction — NOT `upsert`, because uniqueness is enforced by partial indexes
 * the Prisma upsert can't target (see the migration).
 */
async function writePref(id: EmailIdentity, category: NotificationCategory | null, enabled: boolean): Promise<void> {
	const where = { userId: id.recipientUserId, contextPageId: id.contextPageId, category };
	await prisma.$transaction(async (tx) => {
		const existing = await tx.notificationPreference.findFirst({ where, select: { id: true } });
		if (existing) {
			await tx.notificationPreference.update({ where: { id: existing.id }, data: { enabled } });
		} else {
			await tx.notificationPreference.create({ data: { ...where, enabled } });
		}
	});
}

/** Flip an identity's per-context email master (the unsubscribe / settings kill-switch). */
export function setMaster(id: EmailIdentity, enabled: boolean): Promise<void> {
	return writePref(id, null, enabled);
}

/** Set one category preference for an identity. */
export function setPref(id: EmailIdentity, category: NotificationCategory, enabled: boolean): Promise<void> {
	return writePref(id, category, enabled);
}
