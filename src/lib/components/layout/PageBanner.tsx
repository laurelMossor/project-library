"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { API_ME_PAGE } from "@/lib/const/routes";

/**
 * PageBanner
 * Displays a banner when user is acting as a page
 * Shows "Acting as [Page Name]" with option to switch back to user
 */
export function PageBanner() {
	const { data: session, update: updateSession } = useSession();
	const router = useRouter();
	const [pageName, setPageName] = useState<string | null>(null);
	const [switching, setSwitching] = useState(false);

	const activePageId = session?.user?.activePageId;

	// Fetch page name when activePageId changes
	useEffect(() => {
		if (!activePageId) {
			setPageName(null);
			return;
		}

		fetch(API_ME_PAGE)
			.then((res) => {
				if (res.ok) {
					return res.json();
				}
				return null;
			})
			.then((data) => {
				if (data && data.name) {
					setPageName(data.name);
				}
			})
			.catch(() => {
				// Silently fail - banner just won't show page name
			});
	}, [activePageId]);

	if (!activePageId || !pageName) {
		return null;
	}

	const handleSwitchToUser = async () => {
		setSwitching(true);

		try {
			const res = await fetch(API_ME_PAGE, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ activePageId: null }),
			});

			if (res.ok) {
				// Update session to clear activePageId
				await updateSession({ activePageId: null });
				router.push("/u/profile");
			}
		} catch {
			// Silently fail
		} finally {
			setSwitching(false);
		}
	};

	return (
		<div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
			<div className="max-w-7xl mx-auto flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-sm text-blue-800">
						Acting as <strong>{pageName}</strong>
					</span>
				</div>
				<Button
					onClick={handleSwitchToUser}
					disabled={switching}
					loading={switching}
					variant="secondary"
					size="sm"
				>
					Switch to User
				</Button>
			</div>
		</div>
	);
}
