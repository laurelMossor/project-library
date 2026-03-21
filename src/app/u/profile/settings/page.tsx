/**
 * USER PROFILE SETTINGS PAGE
 *
 * This is the user's settings page at /u/profile/settings.
 * - Protected route (requires authentication)
 * - Allows switching active page
 * - Links to edit pages
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { Button } from "@/lib/components/ui/Button";
import { LOGIN_WITH_CALLBACK, HOME, API_ME_PAGES, API_ME_PAGE, PRIVATE_PAGE, PRIVATE_USER_PAGE, USER_PROFILE_EDIT, PAGE_PROFILE_EDIT, USER_PROFILE_SETTINGS } from "@/lib/const/routes";

interface PageInfo {
	id: string;
	name: string;
	slug: string;
}

export default function UserSettingsPage() {
	const { data: session, update: updateSession } = useSession();
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [pages, setPages] = useState<PageInfo[]>([]);
	const [switching, setSwitching] = useState(false);
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

			// Update session with new activePageId
			await updateSession({ activePageId: pageId });

			// Redirect to page profile
			router.push(PRIVATE_PAGE);
		} catch (err) {
			setError("Failed to switch to page");
			setSwitching(false);
		}
	};

	const handleClearActivePage = async () => {
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
				setError(data.error || "Failed to clear active page");
				setSwitching(false);
				return;
			}

			// Update session to clear activePageId
			await updateSession({ activePageId: null });

			// Redirect to user profile
			router.push(PRIVATE_USER_PAGE);
		} catch (err) {
			setError("Failed to clear active page");
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
				<h1 className="text-3xl font-bold mb-2">Settings</h1>
				<p className="text-gray-600">Manage your account settings and switch between user and page profiles</p>
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
							onClick={handleClearActivePage}
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
					</div>
				)}
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Pages</h2>
				{pages.length === 0 ? (
					<p className="text-sm text-gray-600">You don&apos;t have any pages yet.</p>
				) : (
					<div className="space-y-3">
						<p className="text-sm text-gray-600 mb-4">Switch to a page to manage it:</p>
						{pages.map((page) => (
							<div key={page.id} className="flex items-center justify-between p-3 border rounded">
								<div>
									<p className="font-medium">{page.name}</p>
									<p className="text-sm text-gray-500">@{page.slug}</p>
								</div>
								<Button
									onClick={() => handleSwitchToPage(page.id)}
									disabled={switching || activePageId === page.id}
									loading={switching}
									variant="secondary"
									size="sm"
								>
									{activePageId === page.id ? "Active" : "Switch To"}
								</Button>
							</div>
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
