// ⚠️ SERVER-ONLY: the write side of the email channel.
//
// Producers (the activity dispatcher + the message-send route) enqueue one row per recipient identity;
// the scheduled flush (email-flush.ts) is the single consumer. No preference check happens here — the
// flush is authoritative, so a preference or read change inside the window is still honored, and enqueue
// stays a cheap insert that never blocks the triggering action. The in-app bell / inbox fire separately.

import { NotificationCategory, EmailSourceType } from "@prisma/client";
import { prisma } from "./prisma";

export type EmailOutboxEntry = {
	recipientUserId: string;
	contextPageId: string | null;
	category: NotificationCategory;
	sourceType: EmailSourceType;
	sourceId: string;
};

/** Enqueue pending email rows. No-op on empty. */
export async function enqueueEmails(entries: EmailOutboxEntry[]): Promise<void> {
	if (entries.length === 0) return;
	await prisma.emailOutbox.createMany({ data: entries });
}
