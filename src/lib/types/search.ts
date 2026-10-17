import type { ProfileVisibility } from "@prisma/client";
import type { FollowState } from "@/lib/actions/follow";
import type { CardEntity, CardUser } from "./card";

export type SearchResultItem = {
	type: "user" | "page";
	id: string;
	handle: string;
	name: string;
	headline: string | null;
	interests: string[];
	/** PRIVATE shows as a stub (no headline/interests) and Follow becomes a request. */
	profileVisibility: ProfileVisibility;
	/**
	 * Set when the server already knows it (Find people suggestions). Absent means the Follow
	 * button loads it itself — typed search and the profile page.
	 */
	followState?: FollowState;
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
};

/** A user search result as a CardUser (its display name goes in `displayName`). */
export function searchResultUser(r: SearchResultItem): CardUser {
	return { id: r.id, handle: r.handle, displayName: r.name, avatarImageId: r.avatarImageId, avatarImage: r.avatarImage ?? null };
}

/**
 * A search result as a card entity for ProfilePicture/ProfileTag. Users must not carry `name`, or
 * `isCardPage` reads them as pages.
 */
export function searchResultEntity(r: SearchResultItem): CardEntity {
	if (r.type === "user") return searchResultUser(r);
	return { id: r.id, handle: r.handle, name: r.name, avatarImageId: r.avatarImageId, avatarImage: r.avatarImage ?? null };
}
