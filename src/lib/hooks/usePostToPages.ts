"use client";

import { useEffect, useState } from "react";
import { API_ME_PAGES } from "@/lib/const/routes";
import { mayPostToPage } from "@/lib/const/roles";

export type PostToPage = {
	id: string;
	name: string;
	handle: string;
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
	role: string;
	allowMemberPosts: boolean;
};

/** Pages the current user can post TO: acting roles always, members only when the page allows it. */
export function usePostToPages() {
	const [pages, setPages] = useState<PostToPage[]>([]);

	useEffect(() => {
		let cancelled = false;
		fetch(API_ME_PAGES)
			.then((r) => (r.ok ? r.json() : []))
			.then((data: PostToPage[]) => {
				if (!cancelled) setPages((data ?? []).filter((p) => mayPostToPage(p.role, p.allowMemberPosts)));
			})
			.catch(() => {
				if (!cancelled) setPages([]);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return pages;
}
