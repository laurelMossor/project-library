// Messaging limits and identity helpers — client-safe, shared by the validators, the server layer, the
// email flush, and the messaging UI. The ONE place a user-or-page messaging identity is encoded.

/** Max participants (users + pages, including the creator) in a GROUP conversation. A group rule,
 *  not a model limit — a future Page chat room would be its own conversation kind. */
export const MAX_GROUP_PARTICIPANTS = 20;

/** Max length of a group's optional display name. */
export const MAX_GROUP_NAME_LENGTH = 80;

/** A messaging identity: a user or a page, by id. */
export type MessagingIdentityRef = { type: "user" | "page"; id: string };

/** Stable string key for an identity (`user:<id>` / `page:<id>`) — for sets, maps, and React keys. */
export const identityKey = (ref: MessagingIdentityRef) => `${ref.type}:${ref.id}`;

/** The identity a participant row (exactly one of userId/pageId) stands for. */
export function participantIdentity(p: { userId: string | null; pageId: string | null }): MessagingIdentityRef {
	return p.pageId ? { type: "page", id: p.pageId } : { type: "user", id: p.userId! };
}

/** The `asPageId` an identity acts as — the page's id, or undefined when acting personally. */
export const asPageIdOf = (ref: MessagingIdentityRef) => (ref.type === "page" ? ref.id : undefined);
