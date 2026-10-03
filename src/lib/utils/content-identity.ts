import type { CardPage, CardUser } from "@/lib/types/card";

type IdentityItem = {
	user: CardUser;
	page: CardPage | null;
	/** Who is speaking. Null means the author; when set, the page. */
	asPageId: string | null;
};

/**
 * Who a post or event speaks as, and the page it was posted to (if that's a
 * different fact). Speaking as a page has no "› page" — the page is the voice.
 * Posting to a page as yourself is "Alice › Page".
 */
export function contentIdentity(item: IdentityItem): { voice: CardUser | CardPage; placedIn: CardPage | null } {
	const speakingAsPage = Boolean(item.asPageId && item.page);
	return {
		voice: speakingAsPage ? item.page! : item.user,
		placedIn: speakingAsPage ? null : item.page,
	};
}
