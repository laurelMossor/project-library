"use client";

import { useState, useEffect } from "react";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { UserSettingsContent } from "./profile-settings/UserSettingsContent";
import { PageSettingsContent } from "./profile-settings/PageSettingsContent";
import { PUBLIC_PROFILE, API_ME_USER, API_ME_PAGE, API_ME_PAGES } from "@/lib/const/routes";
import type { PublicUser } from "@/lib/types/user";
import type { PublicPage } from "@/lib/types/page";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";

export function ProfilePageView() {
	const { activeEntity, activePageId, currentUser, loading: profileLoading } = useActiveProfile();

	const [user, setUser] = useState<PublicUser | null>(null);
	const [page, setPage] = useState<PublicPage | null>(null);
	const [pages, setPages] = useState<PageItem[]>([]);
	const [dataLoading, setDataLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!activeEntity) return;

		setDataLoading(true);
		setError(null);

		const isPage = !!activePageId;

		const entityFetch = isPage
			? fetch(API_ME_PAGE).then((r) => (r.ok ? r.json() : null))
			: fetch(API_ME_USER).then((r) => (r.ok ? r.json() : null));

		const pagesFetch = fetch(API_ME_PAGES)
			.then((r) => (r.ok ? r.json() : []))
			.then((data: PageItem[]) =>
				data.filter((p) => p.role === "ADMIN" || p.role === "EDITOR"),
			);

		Promise.all([entityFetch, pagesFetch])
			.then(([entityData, pagesData]) => {
				if (isPage) {
					setPage(entityData as PublicPage);
					setUser(null);
				} else {
					setUser(entityData as PublicUser);
					setPage(null);
				}
				setPages(pagesData);
			})
			.catch(() => setError("Failed to load profile data"))
			.finally(() => setDataLoading(false));
	// activeEntity?.id tracks identity changes; adding the full object would re-run on every reference change
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeEntity?.id, activePageId]);

	if (profileLoading || !currentUser || !activeEntity) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

	if (dataLoading) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading profile...</p>;
	}

	if (error) {
		return <p className="text-sm text-red-500 text-center py-12">{error}</p>;
	}

	if (page && activePageId) {
		return (
			<PageSettingsContent
				page={page}
				pages={pages}
				publicProfileHref={PUBLIC_PROFILE(page.handle)}
			/>
		);
	}

	if (user) {
		return (
			<UserSettingsContent
				user={user}
				pages={pages}
				publicProfileHref={PUBLIC_PROFILE(user.handle)}
			/>
		);
	}

	return <p className="text-sm text-red-500 text-center py-12">Could not load profile.</p>;
}
