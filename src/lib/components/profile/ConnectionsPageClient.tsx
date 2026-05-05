"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ConnectionsPageView } from "./ConnectionsPageView";
import { ConnectionsView } from "./ConnectionsView";
import { getUserDisplayName } from "@/lib/types/user";
import { API_ME_USER, API_ME_PAGES, PUBLIC_PROFILE } from "@/lib/const/routes";
import type { PublicUser } from "@/lib/types/user";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";

export function ConnectionsPageClient() {
	const { activeEntity, activePageId, currentUser, loading: profileLoading } = useActiveProfile();

	const [user, setUser] = useState<PublicUser | null>(null);
	const [managedPages, setManagedPages] = useState<PageItem[]>([]);
	const [dataLoading, setDataLoading] = useState(true);

	useEffect(() => {
		if (!activeEntity) return;

		setDataLoading(true);

		const isPage = !!activePageId;

		if (isPage) {
			setDataLoading(false);
			return;
		}

		const userFetch = fetch(API_ME_USER).then((r) => (r.ok ? r.json() : null));
		const pagesFetch = fetch(API_ME_PAGES)
			.then((r) => (r.ok ? r.json() : []))
			.then((data: PageItem[]) =>
				data.filter((p) => p.role === "ADMIN" || p.role === "EDITOR"),
			);

		Promise.all([userFetch, pagesFetch])
			.then(([userData, pagesData]) => {
				setUser(userData as PublicUser);
				setManagedPages(pagesData);
			})
			.catch(() => {})
			.finally(() => setDataLoading(false));
	}, [activeEntity?.id, activePageId]);

	if (profileLoading || !currentUser || !activeEntity) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

	if (dataLoading) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading connections...</p>;
	}

	const handle = activeEntity.handle;
	const isPage = !!activePageId;

	if (isPage) {
		const displayName = "name" in activeEntity ? activeEntity.name : handle;

		return (
			<>
				<div className="mb-6">
					<Link
						href={PUBLIC_PROFILE(handle)}
						className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
					>
						&larr; Back to {displayName}&apos;s profile
					</Link>
					<h1 className="text-2xl font-bold mt-2">
						{displayName}&apos;s Connections
					</h1>
				</div>
				<ConnectionsView entityId={activeEntity.id} entityType="page" />
			</>
		);
	}

	if (user) {
		const displayName = getUserDisplayName(user);

		return (
			<>
				<div className="mb-6">
					<Link
						href={PUBLIC_PROFILE(handle)}
						className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
					>
						&larr; Back to {displayName}&apos;s profile
					</Link>
					<h1 className="text-2xl font-bold mt-2">
						{displayName}&apos;s Connections
					</h1>
				</div>
				<ConnectionsPageView
					user={{
						id: user.id,
						handle: user.handle,
						displayName: user.displayName ?? null,
						firstName: user.firstName ?? null,
						lastName: user.lastName ?? null,
						avatarImageId: user.avatarImageId ?? null,
						avatarImage: user.avatarImage ?? null,
					}}
					pages={managedPages.map((p) => ({
						id: p.id,
						handle: p.handle,
						name: p.name,
						avatarImageId: p.avatarImageId ?? null,
						avatarImage: null,
						role: p.role ?? "MEMBER",
					}))}
				/>
			</>
		);
	}

	return <p className="text-sm text-red-500 text-center py-12">Could not load connections.</p>;
}
