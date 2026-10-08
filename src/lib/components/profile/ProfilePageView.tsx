"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { UserSettingsContent } from "./profile-settings/UserSettingsContent";
import { PageSettingsContent } from "./profile-settings/PageSettingsContent";
import { PUBLIC_PROFILE, API_ME_USER, API_ME_PAGE, API_ME_PAGES } from "@/lib/const/routes";
import { Breadcrumb } from "@/lib/components/layout/Breadcrumb";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { isActingRole } from "@/lib/const/roles";
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
			.then((data: PageItem[]) => data.filter((p) => isActingRole(p.role)));

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

	const identityReady = !profileLoading && !!currentUser && !!activeEntity;
	const identityName = !activeEntity
		? ""
		: isCardPage(activeEntity)
			? activeEntity.name
			: getCardUserDisplayName(activeEntity);

	if (!identityReady || !activeEntity) {
		return (
			<>
				<SettingsHeading />
				<p className="text-sm text-dusty-grey text-center py-12">Loading...</p>
			</>
		);
	}

	let body: ReactNode;
	if (dataLoading) {
		body = <p className="text-sm text-dusty-grey text-center py-12">Loading profile...</p>;
	} else if (error) {
		body = <p className="text-sm text-red-500 text-center py-12">{error}</p>;
	} else if (page && activePageId) {
		body = (
			<PageSettingsContent
				page={page}
				pages={pages}
				publicProfileHref={PUBLIC_PROFILE(page.handle)}
			/>
		);
	} else if (user) {
		body = (
			<UserSettingsContent
				user={user}
				pages={pages}
				publicProfileHref={PUBLIC_PROFILE(user.handle)}
			/>
		);
	} else {
		body = <p className="text-sm text-red-500 text-center py-12">Could not load profile.</p>;
	}

	return (
		<>
			<div className="mb-3">
				<Breadcrumb href={PUBLIC_PROFILE(activeEntity.handle)} label={`Back to ${identityName}`} />
			</div>
			<SettingsHeading />
			{body}
		</>
	);
}

function SettingsHeading() {
	return (
		<div className="mb-8">
			<HeadingTitle title="Settings" />
			<p className="text-gray-600">
				Manage your profile information and account settings
			</p>
		</div>
	);
}
