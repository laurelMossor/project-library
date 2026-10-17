"use client";

import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useIsOwnProfile } from "@/lib/hooks/useIsOwnProfile";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { MessageIcon } from "@/lib/components/icons/icons";
import { MESSAGE_CONVERSATION } from "@/lib/const/routes";
import { FollowButton } from "./FollowButton";
import type { ProfileVisibility } from "@prisma/client";

type ProfileButtonsProps = {
	entityId: string;
	entityType: "user" | "page";
	/** The viewed entity's profile visibility. PRIVATE means Follow opens a pending request. */
	profileVisibility?: ProfileVisibility;
};

/**
 * Follow/Request + Message action buttons for public User and Page profiles.
 * Omitted entirely when the viewer's active profile is the entity being viewed.
 */
export function ProfileButtons({ entityId, entityType, profileVisibility }: ProfileButtonsProps) {
	const { currentUser } = useActiveProfile();
	if (useIsOwnProfile(entityId, entityType)) return null;

	return (
		<div className="flex flex-col gap-2 w-full">
			<FollowButton entityId={entityId} entityType={entityType} profileVisibility={profileVisibility} />
			{currentUser ? (
				<TransparentCTAButton
					label="Message"
					icon={<MessageIcon className="w-4 h-4" />}
					href={MESSAGE_CONVERSATION({ id: entityId, type: entityType })}
					className="w-full"
				/>
			) : (
				<TransparentCTAButton label="Message" icon={<MessageIcon className="w-4 h-4" />} onClick={() => {}} disabled className="w-full" />
			)}
		</div>
	);
}
