// ⚠️ SERVER-ONLY: the single place a post or event's draft → published lifecycle is decided.
//
// Publishing is one-way: a published post or event never goes back to DRAFT. Everything that hangs
// off "this just went live" (page-member notifications today) relies on that, so it fires once.

import type { PostStatus, EventStatus } from "@prisma/client";
import { DomainError } from "./domain-error";

type ContentStatus = PostStatus | EventStatus;

/**
 * Check a requested status change against the stored one, and report whether this write publishes.
 * `from` is null for a create. `to` undefined means the write leaves status alone.
 * Throws on PUBLISHED → DRAFT.
 */
export function assertStatusTransition(from: ContentStatus | null, to: ContentStatus | undefined): { publishes: boolean } {
	if (from === "PUBLISHED" && to === "DRAFT") {
		throw new DomainError("A published post or event can't go back to draft");
	}
	return { publishes: to === "PUBLISHED" && from !== "PUBLISHED" };
}
