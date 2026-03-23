"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { API_ME_PAGE, PRIVATE_USER_PAGE } from "@/lib/const/routes";
import { useSession } from "next-auth/react";

/**
 * ActingAsPageTooltip
 * Shows a dismissible tooltip when user is redirected from user profile
 * because they are acting as a page
 */
export function ActingAsPageTooltip() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const { update: updateSession } = useSession();
	const [isVisible, setIsVisible] = useState(false);
	const [switching, setSwitching] = useState(false);
	const [pageSlug, setPageSlug] = useState<string | null>(null);

	useEffect(() => {
		// Check if redirected from user profile
		const from = searchParams.get("from");
		const page = searchParams.get("page");

		if (from === "user_profile") {
			setIsVisible(true);
			setPageSlug(page);

			// Clean up URL without causing navigation
			const url = new URL(window.location.href);
			url.searchParams.delete("from");
			url.searchParams.delete("page");
			window.history.replaceState({}, "", url.pathname);
		}
	}, [searchParams]);

	const handleSwitchToUser = async () => {
		setSwitching(true);

		try {
			const res = await fetch(API_ME_PAGE, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ activePageId: null }),
			});

			if (res.ok) {
				await updateSession({ activePageId: null });
				router.push(PRIVATE_USER_PAGE);
			}
		} catch (err) {
			// Silently fail
		} finally {
			setSwitching(false);
		}
	};

	const handleDismiss = () => {
		setIsVisible(false);
	};

	if (!isVisible) {
		return null;
	}

	return (
		<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 relative">
			<button
				onClick={handleDismiss}
				className="absolute top-2 right-2 text-amber-600 hover:text-amber-800 text-lg leading-none"
				aria-label="Dismiss"
			>
				&times;
			</button>
			<div className="pr-6">
				<p className="text-sm text-amber-800 mb-3">
					You are logged in as <strong>@{pageSlug || "a page"}</strong> right now.
					Switch to your user profile to edit your personal information.
				</p>
				<Button
					onClick={handleSwitchToUser}
					disabled={switching}
					loading={switching}
					variant="secondary"
					size="sm"
				>
					Switch to User Profile
				</Button>
			</div>
		</div>
	);
}
