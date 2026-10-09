// ⚠️ SERVER-ONLY: the single place a post or event decides where it lives and who is speaking.
//
// pageId     = where it lives, and therefore its audience (visibility is inherited from there).
// asPageId   = who is speaking. Null means the author. When set it equals pageId.
// userId     = the human author, always.
//
// Create and PATCH routes call this instead of branching on pageId themselves.

import { canPostAsPage, canPostToPage } from "./permission";
import { DomainError } from "./domain-error";

/** Caller/client-fixable placement problem. Routes map this to a 400. */
export class PlacementError extends DomainError {}

/** The caller is not allowed to post to or as this page. Routes map this to a 403. */
export class PlacementForbiddenError extends PlacementError {
	constructor(message: string) {
		super(message, "forbidden");
	}
}

export type ContentPlacement = {
	pageId: string | null;
	asPageId: string | null;
	showOnAuthorProfile: boolean;
};

type PlacementInput = {
	asPageId?: string | null;
	pageId?: string | null;
	showOnAuthorProfile?: boolean | null;
	/** A reply copies its parent's placement. Voice and audience are not chosen again. */
	parent?: ContentPlacement | null;
};

/**
 * Resolve where a piece of content lives and who is speaking.
 * - asPageId set → speaking as that page; it also lives there; never on the author's profile.
 * - pageId only → posting TO that page, as the author. Requires canPostToPage.
 * - neither → a personal post.
 */
export async function resolveContentPlacement(userId: string, input: PlacementInput): Promise<ContentPlacement> {
	if (input.parent) {
		return {
			pageId: input.parent.pageId,
			asPageId: input.parent.asPageId,
			showOnAuthorProfile: input.parent.showOnAuthorProfile,
		};
	}

	const asPageId = input.asPageId || null;
	if (asPageId) {
		if (!(await canPostAsPage(userId, asPageId))) {
			throw new PlacementForbiddenError("You don't have permission to post as this page");
		}
		return { pageId: asPageId, asPageId, showOnAuthorProfile: false };
	}

	const pageId = input.pageId || null;
	if (pageId) {
		if (!(await canPostToPage(userId, pageId))) {
			throw new PlacementForbiddenError("You don't have permission to post to this page");
		}
		return {
			pageId,
			asPageId: null,
			showOnAuthorProfile: input.showOnAuthorProfile === true,
		};
	}

	return { pageId: null, asPageId: null, showOnAuthorProfile: false };
}
