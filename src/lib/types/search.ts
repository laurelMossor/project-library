export type SearchResultItem = {
	type: "user" | "page";
	id: string;
	handle: string;
	name: string;
	headline: string | null;
	interests: string[];
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
};
