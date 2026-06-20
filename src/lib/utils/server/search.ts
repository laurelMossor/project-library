// ⚠️ SERVER-ONLY: Profile search utility
import { prisma } from "./prisma";
import type { SearchResultItem } from "@/lib/types/search";
import { profileListWhere, type ViewerContext } from "./visibility";

const ANON_VIEWER: ViewerContext = { userId: null, memberPageIds: [] };

const searchUserFields = {
	id: true,
	handle: true,
	displayName: true,
	headline: true,
	interests: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
} as const;

const searchPageFields = {
	id: true,
	handle: true,
	name: true,
	headline: true,
	interests: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
} as const;

type SearchProfilesOptions = {
	type?: "user" | "page" | "all";
	limit?: number;
	viewer?: ViewerContext;
};

export async function searchProfiles(
	query: string,
	{ type = "all", limit = 12, viewer = ANON_VIEWER }: SearchProfilesOptions = {}
): Promise<SearchResultItem[]> {
	if (query.length < 2) return [];

	const filter = { contains: query, mode: "insensitive" as const };

	const results: SearchResultItem[] = [];

	if (type === "all" || type === "user") {
		const users = await prisma.user.findMany({
			where: {
				AND: [
					profileListWhere("USER", viewer),
					{
						OR: [
							{ handle: filter },
							{ displayName: filter },
							{ firstName: filter },
							{ lastName: filter },
						],
					},
				],
			},
			select: searchUserFields,
			take: limit,
			orderBy: { displayName: "asc" },
		});

		for (const u of users) {
			results.push({
				type: "user",
				id: u.id,
				handle: u.handle,
				name: u.displayName ?? u.handle,
				headline: u.headline,
				interests: u.interests,
				avatarImageId: u.avatarImageId,
				avatarImage: u.avatarImage,
			});
		}
	}

	if (type === "all" || type === "page") {
		const pages = await prisma.page.findMany({
			where: {
				AND: [
					profileListWhere("PAGE", viewer),
					{
						OR: [
							{ handle: filter },
							{ name: filter },
						],
					},
				],
			},
			select: searchPageFields,
			take: limit,
			orderBy: { name: "asc" },
		});

		for (const p of pages) {
			results.push({
				type: "page",
				id: p.id,
				handle: p.handle,
				name: p.name,
				headline: p.headline,
				interests: p.interests,
				avatarImageId: p.avatarImageId,
				avatarImage: p.avatarImage,
			});
		}
	}

	return results.slice(0, limit);
}
