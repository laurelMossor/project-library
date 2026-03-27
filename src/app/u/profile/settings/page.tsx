/**
 * USER PROFILE SETTINGS PAGE
 *
 * This is the user's settings page at /u/profile/settings.
 * - Protected route (requires authentication)
 * - Shows user's pages with links to view/edit
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { LOGIN_WITH_CALLBACK, HOME, API_ME_PAGES, PRIVATE_USER_PAGE, USER_PROFILE_EDIT, USER_PROFILE_SETTINGS, PUBLIC_PAGE } from "@/lib/const/routes";

interface PageInfo {
	id: string;
	name: string;
	slug: string;
}

export default function UserSettingsPage() {
	const { data: session } = useSession();
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [pages, setPages] = useState<PageInfo[]>([]);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!session?.user?.id) {
			router.push(LOGIN_WITH_CALLBACK(USER_PROFILE_SETTINGS));
			return;
		}

		// Fetch user's pages
		fetch(API_ME_PAGES)
			.then((res) => {
				if (res.status === 401) {
					router.push(LOGIN_WITH_CALLBACK(USER_PROFILE_SETTINGS));
					return;
				}
				return res.json();
			})
			.then((data) => {
				if (data && !data.error) {
					setPages(data);
				}
				setLoading(false);
			})
			.catch(() => {
				setError("Failed to load pages");
				setLoading(false);
			});
	}, [session, router]);

	if (loading) {
		return (
			<CenteredLayout maxWidth="2xl">
				<div>Loading...</div>
			</CenteredLayout>
		);
	}

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">Settings</h1>
				<p className="text-gray-600">Manage your account and pages</p>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
					{error}
				</div>
			)}

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Pages</h2>
				{pages.length === 0 ? (
					<p className="text-sm text-gray-600">You don&apos;t have any pages yet.</p>
				) : (
					<div className="space-y-2">
						{pages.map((page) => (
							<ProfileTag
								key={page.id}
								entity={{ id: page.id, name: page.name, slug: page.slug, avatarImageId: null }}
								actions={
									<ButtonLink href={PUBLIC_PAGE(page.slug)} variant="secondary" size="sm">
										View Page
									</ButtonLink>
								}
							/>
						))}
					</div>
				)}
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Quick Links</h2>
				<div className="flex flex-col gap-3">
					<ButtonLink href={PRIVATE_USER_PAGE} variant="secondary" fullWidth>
						User Profile
					</ButtonLink>
					<ButtonLink href={USER_PROFILE_EDIT} variant="secondary" fullWidth>
						Edit User Profile
					</ButtonLink>
				</div>
			</div>

			<div className="flex gap-4 justify-center">
				<a href={HOME} className="text-sm underline text-gray-600">Home</a>
			</div>
		</CenteredLayout>
	);
}
