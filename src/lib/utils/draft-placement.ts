import { NEW_IN_OWN_PROFILE } from "@/lib/const/routes";

export type DraftPlacement = { asPageId: string | null; pageId: string | null };

/**
 * Who speaks and where a new draft lives, for /posts/new and /events/new.
 * `to` is the collection the draft was started from: a page id, NEW_IN_OWN_PROFILE, or null.
 * With no target, the active profile decides. From your own profile: you, personal. From a
 * page's collection: as that page if you're acting as it, otherwise to it in your own voice —
 * acting as some other page doesn't carry over. The server still checks both (resolveContentPlacement).
 */
export function draftPlacement(to: string | null, activePageId: string | null): DraftPlacement {
	if (!to) return { asPageId: activePageId, pageId: null };
	if (to === NEW_IN_OWN_PROFILE) return { asPageId: null, pageId: null };
	return { asPageId: activePageId === to ? to : null, pageId: to };
}
