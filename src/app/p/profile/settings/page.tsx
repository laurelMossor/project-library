/**
 * PAGE PROFILE SETTINGS PAGE
 *
 * This is the page's settings page at /p/profile/settings.
 * - Protected route (requires authentication)
 * - Allows managing page permissions
 * - Links to edit pages
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { Button } from "@/lib/components/ui/Button";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { LOGIN_WITH_CALLBACK, HOME, API_ME_PAGES, API_ME_PAGE, PRIVATE_PAGE, PRIVATE_USER_PAGE, PAGE_PROFILE_EDIT, PAGE_PROFILE_SETTINGS } from "@/lib/const/routes";

interface PageInfo {
	id: string;
	name: string;
	slug: string;
}

export default function PageSettingsPage() {
	const { data: session, update: updateSession } = useSession();
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [pages, setPages] = useState<PageInfo[]>([]);
	const [switching, setSwitching] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!session?.user?.id) {
			router.push(LOGIN_WITH_CALLBACK(PAGE_PROFILE_SETTINGS));
			return;
		}

		// Fetch user's pages
		fetch(API_ME_PAGES)
			.then((res) => {
				if (res.status === 401) {
					router.push(LOGIN_WITH_CALLBACK(PAGE_PROFILE_SETTINGS));
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

	const handleSwitchToPage = async (pageId: string) => {
		setSwitching(true);
		setError("");

		try {
			const res = await fetch(API_ME_PAGE, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ activePageId: pageId }),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to switch to page");
				setSwitching(false);
				return;
			}

			await updateSession({ activePageId: pageId });
			router.push(PRIVATE_PAGE);
		} catch {
			setError("Failed to switch to page");
			setSwitching(false);
		}
	};

	const handleSwitchToUser = async () => {
		setSwitching(true);
		setError("");

		try {
			const res = await fetch(API_ME_PAGE, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ activePageId: null }),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to switch to user");
				setSwitching(false);
				return;
			}

			await updateSession({ activePageId: null });
			router.push(PRIVATE_USER_PAGE);
		} catch {
			setError("Failed to switch to user");
			setSwitching(false);
		}
	};

	if (loading) {
		return (
			<CenteredLayout maxWidth="2xl">
				<div>Loading...</div>
			</CenteredLayout>
		);
	}

	const activePageId = session?.user?.activePageId;
	const activePage = pages.find(page => page.id === activePageId);

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
							onClick={handleSwitchToUser}
							disabled={switching}
							loading={switching}
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
								entity={{ id: page.id, name: page.name, slug: page.slug, avatarImageId: null }}
								actions={
									<Button
										onClick={() => handleSwitchToPage(page.id)}
										disabled={switching || activePageId === page.id}
										loading={switching}
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
