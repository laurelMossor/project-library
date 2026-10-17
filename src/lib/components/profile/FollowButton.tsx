"use client";

import { useRouter, usePathname } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useIsOwnProfile } from "@/lib/hooks/useIsOwnProfile";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { Button } from "@/lib/components/ui/Button";
import { PlusSignIcon, MinusSignIcon } from "@/lib/components/icons/icons";
import { LOGIN_WITH_CALLBACK } from "@/lib/const/routes";
import { useFollowState } from "@/lib/hooks/useFollowState";
import type { FollowState } from "@/lib/actions/follow";
import type { ProfileVisibility } from "@prisma/client";

type FollowButtonProps = {
	entityId: string;
	entityType: "user" | "page";
	/** PRIVATE means Follow opens a pending request, so the label says so up front. */
	profileVisibility?: ProfileVisibility;
	/** Server-known state (suggestion cards). Omit it and the button loads the state itself. */
	followState?: FollowState;
	/** "md": the full-width profile-page button. "sm": the condensed button for cards and rows. */
	size?: "md" | "sm";
};

/**
 * Follow / Request / Unfollow toggle for any profile. Renders nothing when the viewer is acting as
 * that profile. Logged out, it sends the viewer to log in and back.
 */
export function FollowButton({ entityId, entityType, profileVisibility, followState, size = "md" }: FollowButtonProps) {
	const router = useRouter();
	const pathname = usePathname();
	const { currentUser } = useActiveProfile();
	const isOwnProfile = useIsOwnProfile(entityId, entityType);

	const loggedIn = !!currentUser;
	const { state, loading, toggling, toggle } = useFollowState(entityId, entityType, loggedIn && !isOwnProfile, followState);

	if (isOwnProfile) return null;

	const busy = loading || toggling;
	const isPrivate = profileVisibility === "PRIVATE";
	const active = state === "following" || state === "requested";
	// Condensed labels keep a card row on one line; the long ones fit a full-width profile button.
	const idleLabel = isPrivate ? (size === "sm" ? "Request" : "Request to follow") : "Follow";
	const label = busy
		? "..."
		: state === "following"
			? (size === "sm" ? "Following" : "Unfollow")
			: state === "requested"
				? "Requested"
				: idleLabel;

	const onClick = loggedIn ? toggle : () => router.push(LOGIN_WITH_CALLBACK(pathname));

	if (size === "sm") {
		return (
			<Button type="button" variant={active ? "secondary" : "primary"} size="sm" onClick={onClick} disabled={loggedIn && busy}>
				{label}
			</Button>
		);
	}

	return (
		<TransparentCTAButton
			label={label}
			icon={active ? <MinusSignIcon className="w-4 h-4" /> : <PlusSignIcon className="w-4 h-4" />}
			onClick={onClick}
			disabled={loggedIn && busy}
			className="w-full"
		/>
	);
}
