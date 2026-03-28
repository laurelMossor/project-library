"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { PRIVATE_USER_PAGE } from "@/lib/const/routes";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";

/**
 * ActingAsPageTooltip
 * Shows a dismissible tooltip when user is redirected from user profile
 * because they are acting as a page
 */
export function ActingAsPageTooltip() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const { switchProfile, loading } = useActiveProfile();
	const [isVisible, setIsVisible] = useState(false);
	const [pageSlug, setPageSlug] = useState<string | null>(null);

	useEffect(() => {
		const from = searchParams.get("from");
		const page = searchParams.get("page");

		if (from === "user_profile") {
			setIsVisible(true);
			setPageSlug(page);

			const url = new URL(window.location.href);
			url.searchParams.delete("from");
			url.searchParams.delete("page");
			window.history.replaceState({}, "", url.pathname);
		}
	}, [searchParams]);

	const handleSwitchToUser = async () => {
		await switchProfile(null);
		router.push(PRIVATE_USER_PAGE);
	};

	if (!isVisible) return null;

	return (
		<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 relative">
			<button
				onClick={() => setIsVisible(false)}
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
					disabled={loading}
					loading={loading}
					variant="secondary"
					size="sm"
				>
					Switch to User Profile
				</Button>
			</div>
		</div>
	);
}
