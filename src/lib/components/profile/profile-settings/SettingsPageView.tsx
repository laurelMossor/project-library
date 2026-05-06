"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ProfileTag } from "../ProfileTag";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { API_ME_USER, API_ME_PAGES, PROFILE, PUBLIC_PROFILE, HOME } from "@/lib/const/routes";
import type { PublicUser } from "@/lib/types/user";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";

export function SettingsPageView() {
	const { currentUser, loading: profileLoading } = useActiveProfile();

	const [viewer, setViewer] = useState<PublicUser | null>(null);
	const [editablePages, setEditablePages] = useState<PageItem[]>([]);
	const [dataLoading, setDataLoading] = useState(true);

	useEffect(() => {
		if (!currentUser) return;

		setDataLoading(true);

		const userFetch = fetch(API_ME_USER).then((r) => (r.ok ? r.json() : null));
		const pagesFetch = fetch(API_ME_PAGES)
			.then((r) => (r.ok ? r.json() : []))
			.then((data: PageItem[]) =>
				data.filter((p) => p.role === "ADMIN" || p.role === "EDITOR"),
			);

		Promise.all([userFetch, pagesFetch])
			.then(([userData, pagesData]) => {
				setViewer(userData as PublicUser);
				setEditablePages(pagesData);
			})
			.catch(() => {})
			.finally(() => setDataLoading(false));
	}, [currentUser?.id]);

	if (profileLoading || !currentUser) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

	if (dataLoading) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading settings...</p>;
	}

	return (
		<>
			{viewer && (
				<div className="bg-white border rounded-lg p-6 mb-6">
					<h2 className="text-xl font-semibold mb-4">Your Profile</h2>
					<ProfileTag
						entity={{
							id: viewer.id,
							handle: viewer.handle,
							displayName: viewer.displayName ?? null,
							avatarImageId: viewer.avatarImageId ?? null,
							avatarImage: viewer.avatarImage ?? null,
						}}
						actions={
							<ButtonLink href={PROFILE} variant="secondary" size="sm">
								Manage
							</ButtonLink>
						}
					/>
				</div>
			)}

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Pages</h2>
				{editablePages.length === 0 ? (
					<p className="text-sm text-gray-600">
						You don&apos;t have any pages yet.
					</p>
				) : (
					<div className="space-y-2">
						{editablePages.map((page) => (
							<ProfileTag
								key={page.id}
								entity={{
									id: page.id,
									handle: page.handle,
									name: page.name,
									avatarImageId: page.avatarImageId ?? null,
								}}
								actions={
									<>
										<ButtonLink
											href={PUBLIC_PROFILE(page.handle)}
											variant="secondary"
											size="sm"
										>
											View
										</ButtonLink>
									</>
								}
							/>
						))}
					</div>
				)}
			</div>

			<div className="flex gap-4 justify-center">
				<Link href={HOME} className="text-sm underline text-gray-600">
					Home
				</Link>
			</div>
		</>
	);
}
