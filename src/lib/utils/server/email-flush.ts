// ⚠️ SERVER-ONLY: the email flush — the single consumer of the EmailOutbox.
//
// Pinged on an interval (a GitHub Action → /api/notifications/flush). It claims pending rows, drops any
// whose source was read or whose preference is now off, groups the survivors by recipient identity into
// one profile-grouped email, sends it, and stamps each row. The flush interval IS the coalescing window;
// read-suppression and coalescing both fall out of "what's still pending and unread at flush time."

import { prisma } from "./prisma";
import { resolveEmailPrefs, prefDecisionKey } from "./notification-preferences";
import { hydrateNotificationRows, type NotificationRowForHydration } from "./notification";
import { notificationMessage } from "@/lib/components/notifications/notification-copy";
import { sendNotificationEmail } from "./email/emails";
import type { EmailProfileSection, EmailNotificationRow } from "./email/templates/NotificationEmail";
import { signUnsubscribeToken } from "./unsubscribe-token";
import { absoluteUrl } from "./url";
import { NOTIFICATIONS_SETTINGS, UNSUBSCRIBE_WITH_TOKEN, MESSAGE_CONVERSATION } from "@/lib/const/routes";
import { publicPageEmbedFields } from "./fields";
import { publicUserEmbedFields } from "./user";
import { resolveCardIdentity } from "@/lib/types/card";
import { truncateText } from "@/lib/utils/text";
import { logAction } from "./log";
import type { ViewerContext } from "./visibility";

/** Reclaim a row whose flush crashed mid-run after this long, so nothing is orphaned. */
const STALE_CLAIM_MS = 10 * 60 * 1000;

export interface FlushResult {
	claimed: number;
	sent: number;
	suppressed: number;
	recipients: number;
}

export async function flushEmailOutbox(): Promise<FlushResult> {
	const now = new Date();
	const claimedAt = now;
	const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);

	// Claim: stamp pending (or stale-claimed) rows with this run's timestamp, then take exactly those.
	// Concurrent runs serialize on the row lock, so a row is claimed by at most one run.
	await prisma.emailOutbox.updateMany({
		where: { sentAt: null, OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] },
		data: { claimedAt },
	});
	const rows = await prisma.emailOutbox.findMany({ where: { sentAt: null, claimedAt } });
	if (rows.length === 0) return { claimed: 0, sent: 0, suppressed: 0, recipients: 0 };

	// Load sources for read-state + hydration.
	const notifIds = rows.filter((r) => r.sourceType === "NOTIFICATION").map((r) => r.sourceId);
	const msgIds = rows.filter((r) => r.sourceType === "MESSAGE").map((r) => r.sourceId);
	const [notifs, msgs] = await Promise.all([
		notifIds.length
			? prisma.notification.findMany({
					where: { id: { in: notifIds } },
					select: {
						id: true, type: true, actorUserId: true, actorPageId: true, actorName: true,
						objectType: true, objectId: true, createdAt: true, readAt: true,
					},
				})
			: Promise.resolve([]),
		msgIds.length
			? prisma.message.findMany({
					where: { id: { in: msgIds } },
					select: { id: true, senderId: true, asPageId: true, content: true, readAt: true },
				})
			: Promise.resolve([]),
	]);
	const notifMap = new Map(notifs.map((n) => [n.id, n]));
	const msgMap = new Map(msgs.map((m) => [m.id, m]));

	// Classify each row: suppressed (source gone or already read) vs candidate.
	const suppressed: { id: string; outcome: string }[] = [];
	const candidates: typeof rows = [];
	for (const row of rows) {
		const source = row.sourceType === "NOTIFICATION" ? notifMap.get(row.sourceId) : msgMap.get(row.sourceId);
		if (!source) suppressed.push({ id: row.id, outcome: "SUPPRESSED_MISSING" });
		else if (source.readAt) suppressed.push({ id: row.id, outcome: "SUPPRESSED_READ" });
		else candidates.push(row);
	}

	// Preference gate (authoritative here, not at enqueue) — one batched resolve.
	const decisions = await resolveEmailPrefs(
		candidates.map((r) => ({ recipientUserId: r.recipientUserId, contextPageId: r.contextPageId, category: r.category })),
	);
	const kept: typeof rows = [];
	for (const row of candidates) {
		const on = decisions.get(prefDecisionKey({ recipientUserId: row.recipientUserId, contextPageId: row.contextPageId }, row.category));
		if (on) kept.push(row);
		else suppressed.push({ id: row.id, outcome: "SUPPRESSED_PREF" });
	}

	await stampOutcomes(suppressed, now);
	if (kept.length === 0) return { claimed: rows.length, sent: 0, suppressed: suppressed.length, recipients: 0 };

	// Batch-load everything the emails need.
	const recipientUserIds = [...new Set(kept.map((r) => r.recipientUserId))];
	const sectionPageIds = [...new Set(kept.map((r) => r.contextPageId).filter((id): id is string => !!id))];
	const senderUserIds = [...new Set(
		kept.map((r) => (r.sourceType === "MESSAGE" ? msgMap.get(r.sourceId) : null)).filter(Boolean).filter((m) => !m!.asPageId).map((m) => m!.senderId),
	)];
	const senderPageIds = [...new Set(
		kept.map((r) => (r.sourceType === "MESSAGE" ? msgMap.get(r.sourceId)?.asPageId : null)).filter((id): id is string => !!id),
	)];

	const [recipients, pages, perms, senderUsers] = await Promise.all([
		prisma.user.findMany({
			where: { id: { in: recipientUserIds } },
			select: { id: true, email: true, handle: true, firstName: true, lastName: true, displayName: true, avatarImageId: true, avatarImage: { select: { url: true } } },
		}),
		[...new Set([...sectionPageIds, ...senderPageIds])].length
			? prisma.page.findMany({ where: { id: { in: [...new Set([...sectionPageIds, ...senderPageIds])] } }, select: publicPageEmbedFields })
			: Promise.resolve([]),
		prisma.permission.findMany({
			where: { userId: { in: recipientUserIds }, resourceType: "PAGE" },
			select: { userId: true, resourceId: true },
		}),
		senderUserIds.length
			? prisma.user.findMany({ where: { id: { in: senderUserIds } }, select: publicUserEmbedFields })
			: Promise.resolve([]),
	]);

	const recipientMap = new Map(recipients.map((u) => [u.id, u]));
	const pageMap = new Map(pages.map((p) => [p.id, p]));
	const senderUserMap = new Map(senderUsers.map((u) => [u.id, u]));
	const memberPageIds = new Map<string, string[]>();
	for (const p of perms) {
		const list = memberPageIds.get(p.userId) ?? [];
		list.push(p.resourceId);
		memberPageIds.set(p.userId, list);
	}

	const managePrefsUrl = absoluteUrl(NOTIFICATIONS_SETTINGS);
	let sent = 0;
	const recipientGroups = groupBy(kept, (r) => r.recipientUserId);

	for (const [recipientUserId, recipientRows] of recipientGroups) {
		const user = recipientMap.get(recipientUserId);
		if (!user?.email) {
			await resetClaims(recipientRows, "SUPPRESSED_NO_EMAIL", now);
			continue;
		}
		const viewer: ViewerContext = { userId: recipientUserId, memberPageIds: memberPageIds.get(recipientUserId) ?? [] };

		const sections: EmailProfileSection[] = [];
		for (const [contextKey, sectionRows] of groupBy(recipientRows, (r) => r.contextPageId ?? "")) {
			const contextPageId = contextKey || null;
			const profile = contextPageId ? pageMap.get(contextPageId) : user;
			if (!profile) continue;
			const identity = resolveCardIdentity(profile as never);

			// Notification rows → shared hydrator → copy + deep link.
			const notifRows = sectionRows
				.filter((r) => r.sourceType === "NOTIFICATION")
				.map((r) => notifMap.get(r.sourceId))
				.filter((n): n is NonNullable<typeof n> => !!n) as NotificationRowForHydration[];
			const hydrated = await hydrateNotificationRows(notifRows, viewer);
			const notifEmailRows: EmailNotificationRow[] = hydrated.map((item) => ({
				text: notificationMessage(item),
				href: item.href ? absoluteUrl(item.href) : managePrefsUrl,
			}));

			// Message rows → sender + snippet + conversation link.
			const msgEmailRows: EmailNotificationRow[] = sectionRows
				.filter((r) => r.sourceType === "MESSAGE")
				.map((r) => msgMap.get(r.sourceId))
				.filter((m): m is NonNullable<typeof m> => !!m)
				.map((m) => {
					const senderName = m.asPageId
						? pageMap.get(m.asPageId) ? resolveCardIdentity(pageMap.get(m.asPageId)! as never).name : "Someone"
						: senderUserMap.get(m.senderId) ? resolveCardIdentity(senderUserMap.get(m.senderId)! as never).name : "Someone";
					const other = m.asPageId ? { id: m.asPageId, type: "page" as const } : { id: m.senderId, type: "user" as const };
					return { text: `${senderName}: ${truncateText(m.content, 120)}`, href: absoluteUrl(MESSAGE_CONVERSATION(other)) };
				});

			const emailRows = [...notifEmailRows, ...msgEmailRows];
			if (emailRows.length === 0) continue;

			sections.push({
				name: identity.name,
				handle: identity.handle,
				avatarUrl: (profile as { avatarImage?: { url: string } | null }).avatarImage?.url ?? null,
				initial: identity.initials,
				unsubscribeUrl: absoluteUrl(UNSUBSCRIBE_WITH_TOKEN(signUnsubscribeToken({ recipientUserId, contextPageId }))),
				rows: emailRows,
			});
		}

		if (sections.length === 0) {
			await resetClaims(recipientRows, "SUPPRESSED_EMPTY", now);
			continue;
		}

		try {
			const result = await sendNotificationEmail(user.email, { sections, managePrefsUrl });
			if (result.ok) {
				await stampOutcomes(recipientRows.map((r) => ({ id: r.id, outcome: "SENT" })), now);
				sent += 1;
			} else {
				// Provider rejected — leave for the next window to retry.
				await releaseClaims(recipientRows);
			}
		} catch (err) {
			logAction("email_flush.send_failed", undefined, { recipientUserId, error: String(err) });
			await releaseClaims(recipientRows);
		}
	}

	return { claimed: rows.length, sent, suppressed: suppressed.length, recipients: recipientGroups.size };
}

/** Mark rows terminal (emailed or suppressed): set sentAt + the outcome, grouped by outcome. */
async function stampOutcomes(entries: { id: string; outcome: string }[], now: Date): Promise<void> {
	if (entries.length === 0) return;
	const byOutcome = groupBy(entries, (e) => e.outcome);
	for (const [outcome, group] of byOutcome) {
		await prisma.emailOutbox.updateMany({ where: { id: { in: group.map((g) => g.id) } }, data: { sentAt: now, outcome } });
	}
}

/** Terminal-stamp with an outcome but keep it out of retries (nothing to send). */
async function resetClaims(rows: { id: string }[], outcome: string, now: Date): Promise<void> {
	await stampOutcomes(rows.map((r) => ({ id: r.id, outcome })), now);
}

/** Release a claim so the next flush retries these rows (send failure). */
async function releaseClaims(rows: { id: string }[]): Promise<void> {
	await prisma.emailOutbox.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { claimedAt: null } });
}

/** Stable groupBy preserving first-seen key order. */
function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
	const map = new Map<K, T[]>();
	for (const item of items) {
		const k = key(item);
		const list = map.get(k) ?? [];
		list.push(item);
		map.set(k, list);
	}
	return map;
}
