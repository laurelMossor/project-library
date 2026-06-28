"use client";

import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { isCardPage } from "@/lib/types/card";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { MessageIcon, PlusSignIcon, MinusSignIcon } from "@/lib/components/icons/icons";
import { MESSAGE_CONVERSATION } from "@/lib/const/routes";
import { useFollowState } from "@/lib/hooks/useFollowState";

type ProfileButtonsProps = {
	entityId: string;
	entityType: "user" | "page";
};

/**
 * Follow/Request + Message action buttons for public User and Page profiles.
 * Both buttons are disabled when the viewer's active profile matches the viewed entity.
 */
export function ProfileButtons({ entityId, entityType }: ProfileButtonsProps) {
	const { activeEntity, currentUser } = useActiveProfile();

	// Determine if the viewer's active profile IS the entity being viewed
	const isOwnProfile = (() => {
		if (!activeEntity) return false;
		if (entityType === "page") {
			return isCardPage(activeEntity) && activeEntity.id === entityId;
		}
		// For user profiles, check both active entity and currentUser
		// (a user viewing their own profile while acting as a page should still be considered "own")
		if (!isCardPage(activeEntity) && activeEntity.id === entityId) return true;
		return currentUser?.id === entityId;
	})();

	const loggedIn = !!currentUser;
	const { state, loading: loadingFollow, toggling, toggle } = useFollowState(
		entityId,
		entityType,
		loggedIn && !isOwnProfile,
	);

	const messageHref = MESSAGE_CONVERSATION({ id: entityId, type: entityType });

	const disabled = isOwnProfile || !loggedIn;
	const followLabel = loadingFollow || toggling
		? "..."
		: state === "following"
			? "Unfollow"
			: state === "requested"
				? "Requested"
				: "Follow";
	const followIcon = state === "following" || state === "requested"
		? <MinusSignIcon className="w-4 h-4" />
		: <PlusSignIcon className="w-4 h-4" />;

	return (
		<div className="flex flex-col gap-2 w-full">
			<TransparentCTAButton
				label={followLabel}
				icon={followIcon}
				onClick={toggle}
				disabled={disabled || loadingFollow || toggling}
				className="w-full"
			/>
			{disabled ? (
				<TransparentCTAButton
					label="Message"
					icon={<MessageIcon className="w-4 h-4" />}
					onClick={() => {}}
					disabled
					className="w-full"
				/>
			) : (
				<TransparentCTAButton
					label="Message"
					icon={<MessageIcon className="w-4 h-4" />}
					href={messageHref}
					className="w-full"
				/>
			)}
		</div>
	);
}
