"use client";

import { useState, useEffect } from "react";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { isCardPage } from "@/lib/types/card";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { MessageIcon, PlusSignIcon, MinusSignIcon } from "@/lib/components/icons/icons";
import { MESSAGE_CONVERSATION, API_FOLLOWS, API_FOLLOW } from "@/lib/const/routes";

type ProfileButtonsProps = {
	entityId: string;
	entityType: "user" | "page";
};

/**
 * Follow + Message action buttons for public User and Page profiles.
 * Both buttons are disabled when the viewer's active profile matches the viewed entity.
 */
export function ProfileButtons({ entityId, entityType }: ProfileButtonsProps) {
	const { activeEntity, currentUser } = useActiveProfile();

	const [isFollowing, setIsFollowing] = useState(false);
	const [loadingFollow, setLoadingFollow] = useState(true);
	const [toggling, setToggling] = useState(false);

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

	useEffect(() => {
		if (!loggedIn || isOwnProfile) {
			setLoadingFollow(false);
			return;
		}
		fetch(`${API_FOLLOW(entityId)}?type=${entityType}`)
			.then((r) => r.json())
			.then((d) => setIsFollowing(d.isFollowing ?? false))
			.catch(() => {})
			.finally(() => setLoadingFollow(false));
	}, [entityId, entityType, loggedIn, isOwnProfile]);

	const handleFollow = async () => {
		if (toggling) return;
		setToggling(true);
		try {
			if (isFollowing) {
				await fetch(`${API_FOLLOW(entityId)}?type=${entityType}`, { method: "DELETE" });
				setIsFollowing(false);
			} else {
				const body = entityType === "user"
					? { followingUserId: entityId }
					: { followingPageId: entityId };
				await fetch(API_FOLLOWS, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
				setIsFollowing(true);
			}
		} catch {
			// Leave state unchanged on error
		} finally {
			setToggling(false);
		}
	};

	const messageHref = MESSAGE_CONVERSATION({ id: entityId, type: entityType });

	const disabled = isOwnProfile || !loggedIn;
	const followLabel = loadingFollow || toggling ? "..." : isFollowing ? "Unfollow" : "Follow";
	const followIcon = isFollowing
		? <MinusSignIcon className="w-4 h-4" />
		: <PlusSignIcon className="w-4 h-4" />;

	return (
		<div className="flex flex-col gap-2 w-full">
			<TransparentCTAButton
				label={followLabel}
				icon={followIcon}
				onClick={handleFollow}
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
