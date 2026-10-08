import type { CardUser, CardPage } from "./card";

/**
 * A comment on a Post or Event. Authored by a user; `asPage` is set when the comment
 * was made "as" a page. Shape mirrors the server `commentWithAuthorFields` selector.
 *
 * `author` / `asPage` are assignable to `CardEntity`, so `asPage ?? author` can be
 * handed straight to `ProfilePicture` / `ProfileTag`.
 */
export interface CommentItem {
	id: string;
	authorId: string | null;
	asPageId: string | null;
	postId: string | null;
	eventId: string | null;
	content: string;
	createdAt: Date | string;
	updatedAt: Date | string;
	/** Set when the speaker was removed and the words were cleared. */
	deleted: "USER" | "PAGE" | null;
	/** Lowercase handles in `content` that name a real user or page — rendered bold (see splitMentions). */
	mentions: string[];
	author: (CardUser & { firstName: string | null; lastName: string | null }) | null;
	asPage: CardPage | null;
}

/** Client → server payload for creating a comment. `asPageId` = comment "as" that page. */
export type CommentCreateInput = {
	content: string;
	asPageId?: string | null;
};

/** The identity a comment speaks as: the page when set, else the author. Null for a tombstone. */
export function commentIdentity(comment: CommentItem): CardUser | CardPage | null {
	if (comment.deleted) return null;
	return comment.asPage ?? comment.author;
}
