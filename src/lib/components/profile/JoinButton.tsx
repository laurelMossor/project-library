"use client";

import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { UserPlusSignIcon, UserMinusSignIcon } from "@/lib/components/icons/icons";
import { useMembership } from "@/lib/hooks/useMembership";
import { FEATURES } from "@/lib/const/features";

type JoinButtonProps = {
	pageId: string;
};

/**
 * Self-service Join/Request/Leave button for page profiles.
 * Only visible when the viewer is logged in and acting as their personal identity (not as a page).
 *
 * Hidden entirely while self-service membership is flagged off (beta) — Follow is the
 * single relationship for pages, so this covers both render sites with one guard.
 */
export function JoinButton({ pageId }: JoinButtonProps) {
	const { currentUser, activePageId } = useActiveProfile();

	const loggedIn = !!currentUser;
	// Hide entirely when acting as a page
	const actingAsPage = !!activePageId;

	// Gate before the membership fetch so a flagged-off build issues no needless GET.
	const enabled = FEATURES.SELF_SERVICE_MEMBERSHIP && loggedIn && !actingAsPage;
	const { state, loading, toggling, error, toggle } = useMembership(pageId, enabled);

	if (!enabled || loading) return null;

	const isLeavable = state === "member" || state === "privileged";
	const label = toggling
		? "..."
		: state === "requested"
			? "Requested"
			: isLeavable
				? "Leave group"
				: "Join";
	const icon = isLeavable || state === "requested"
		? <UserMinusSignIcon className="w-4 h-4" />
		: <UserPlusSignIcon className="w-4 h-4" />;

	return (
		<div className="w-full">
			<TransparentCTAButton
				label={label}
				icon={icon}
				onClick={toggle}
				disabled={toggling}
				className="w-full"
			/>
			{error && <p className="mt-1 text-xs text-red-500 text-center">{error}</p>}
		</div>
	);
}
