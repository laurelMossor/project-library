"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/lib/components/ui/Button";
import { PageCard } from "@/lib/components/cards/PageCard";
import { API_ME_PAGE, PRIVATE_PAGE, PRIVATE_USER_PAGE } from "@/lib/const/routes";

export type PageItem = {
	id: string;
	name: string;
	slug: string;
	avatarImageId?: string | null;
};

type PageSwitcherProps = {
	pages?: PageItem[] | null;
	showSwitchToUser?: boolean;
};

/**
 * Component for displaying and switching between pages
 */
export function PageSwitcher({ pages, showSwitchToUser = false }: PageSwitcherProps) {
	const { data: session, update: updateSession } = useSession();
	const router = useRouter();
	const [switching, setSwitching] = useState(false);
	const [error, setError] = useState("");

	const activePageId = session?.user?.activePageId;

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

			// Update session to clear activePageId
			await updateSession({ activePageId: null });

			// Redirect to user profile
			router.push(PRIVATE_USER_PAGE);
		} catch {
			setError("Failed to switch to user");
			setSwitching(false);
		}
	};

	if (!pages) {
		return (
			<p className="text-sm text-gray-500 italic">You don&apos;t have any pages yet.</p>
		);
	}

	return (
		<div className="mt-4">
			<p className="text-sm text-gray-600 mb-3">
				Your pages <span className="text-xs text-gray-400">(To edit admins, go to the page profile)</span>
			</p>
			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-sm">
					{error}
				</div>
			)}
			<div className="space-y-2">
				{pages.map((page) => {
					const isActive = activePageId === page.id;
					return (
						<PageCard
							key={page.id}
							page={{
								id: page.id,
								name: page.name,
								slug: page.slug,
								avatarImageId: page.avatarImageId ?? null,
							}}
							badge={isActive ? "Active" : undefined}
							actions={
								<Button
									onClick={() => handleSwitchToPage(page.id)}
									disabled={switching || isActive}
									loading={switching}
									variant="secondary"
									size="sm"
								>
									{isActive ? "Active" : "Switch To"}
								</Button>
							}
						/>
					);
				})}
			</div>
			{showSwitchToUser && activePageId && (
				<div className="mt-4 pt-4 border-t">
					<Button
						onClick={handleSwitchToUser}
						disabled={switching}
						loading={switching}
						variant="secondary"
						fullWidth
					>
						Switch to User Profile
					</Button>
				</div>
			)}
		</div>
	);
}
