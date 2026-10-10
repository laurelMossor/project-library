"use client";

import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { UserPlusSignIcon, UserMinusSignIcon } from "@/lib/components/icons/icons";
import { useMembership } from "@/lib/hooks/useMembership";
import type { MembershipStatus } from "@/lib/types/connections";
import type { MembershipPolicy } from "@prisma/client";

type JoinButtonProps = {
	pageId: string;
	/** The page's membership policy. Request-to-join shows the button to non-members. */
	membershipPolicy?: MembershipPolicy;
	/** The viewer's role / pending request on this page, read on the server. */
	membership: MembershipStatus;
};

/**
 * Request-to-join / Leave for page profiles.
 * Shown when the viewer is logged in and acting as themselves.
 * "Request to join" appears on every REQUEST_TO_JOIN page. Members of any page see "Leave".
 */
export function JoinButton({ pageId, membershipPolicy, membership }: JoinButtonProps) {
	const { currentUser, activePageId } = useActiveProfile();
	const { state, toggling, error, toggle } = useMembership(pageId, membership);

	const enabled = !!currentUser && !activePageId;
	if (!enabled) return null;

	const isLeavable = state === "member" || state === "privileged";
	const canRequest = membershipPolicy === "REQUEST_TO_JOIN";
	if (!isLeavable && !canRequest && state !== "requested") return null;

	const label = toggling
		? "..."
		: state === "requested"
			? "Requested"
			: isLeavable
				? "Leave"
				: "Request to join";
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
