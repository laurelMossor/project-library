/**
 * PAGE PROFILE SETTINGS PAGE
 *
 * This is the page's settings page at /p/profile/settings.
 * - Protected route (requires authentication)
 * - Allows managing page permissions
 * - Links to edit pages
 */
"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { Button } from "@/lib/components/ui/Button";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { LOGIN_WITH_CALLBACK, HOME, PRIVATE_PAGE, PRIVATE_USER_PAGE, PAGE_PROFILE_EDIT, PAGE_PROFILE_SETTINGS } from "@/lib/const/routes";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useEffect } from "react";

export default function PageSettingsPage() {
	const { data: session } = useSession();
	const router = useRouter();
	const { pages, fetchPages, switchProfile, activePageId, loading, error } = useActiveProfile();

	useEffect(() => {
		if (!session?.user?.id) {
			router.push(LOGIN_WITH_CALLBACK(PAGE_PROFILE_SETTINGS));
			return;
		}
		fetchPages();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [session?.user?.id]);

	if (!session?.user?.id) return null;

	const activePage = pages.find((page) => page.id === activePageId);

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">Page Settings</h1>
				<p className="text-gray-600">Manage page settings and switch between profiles</p>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
					{error}
				</div>
			)}

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Active Profile</h2>
				{activePage ? (
					<div className="space-y-3">
						<p className="text-sm text-gray-600">You are currently acting as a page.</p>
						<Button
							onClick={() => switchProfile(null).then(() => router.push(PRIVATE_USER_PAGE))}
							disabled={loading}
							loading={loading}
							variant="secondary"
						>
							Switch to User Profile
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						<p className="text-sm text-gray-600">You are currently acting as your user account.</p>
						<p className="text-sm text-gray-500">Select a page below to switch to its profile.</p>
					</div>
				)}
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Pages</h2>
				{pages.length === 0 ? (
					<p className="text-sm text-gray-600">You don&apos;t have any pages yet.</p>
				) : (
					<div className="space-y-2">
						<p className="text-sm text-gray-600 mb-4">Switch to a page profile to manage it:</p>
						{pages.map((page) => (
							<ProfileTag
								key={page.id}
								entity={{ id: page.id, name: page.name, slug: page.slug, avatarImageId: page.avatarImageId, avatarImage: page.avatarImage }}
								actions={
									<Button
										onClick={() => switchProfile(page.id).then(() => router.push(PRIVATE_PAGE))}
										disabled={loading || activePageId === page.id}
										loading={loading}
										variant="secondary"
										size="sm"
									>
										{activePageId === page.id ? "Active" : "Switch To"}
									</Button>
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
					{activePage && (
						<>
							<ButtonLink href={PRIVATE_PAGE} variant="secondary" fullWidth>
								Page Profile
							</ButtonLink>
							<ButtonLink href={PAGE_PROFILE_EDIT} variant="secondary" fullWidth>
								Edit Page Profile
							</ButtonLink>
						</>
					)}
				</div>
			</div>

			<div className="flex gap-4 justify-center">
				<a href={HOME} className="text-sm underline text-gray-600">Home</a>
			</div>
		</CenteredLayout>
	);
}
