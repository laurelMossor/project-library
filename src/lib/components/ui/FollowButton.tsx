"use client";

import { useState, useEffect } from "react";
import { API_FOLLOWS, API_FOLLOW } from "@/lib/const/routes";

type FollowButtonProps = {
	targetId: string;
	targetType: "user" | "page";
	currentUserId: string | null | undefined;
};

/**
 * Follow/Unfollow button for user and page profiles.
 * Hidden when the viewer is not logged in or is viewing their own profile.
 */
export function FollowButton({ targetId, targetType, currentUserId }: FollowButtonProps) {
	const [isFollowing, setIsFollowing] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!currentUserId || currentUserId === targetId) return;

		fetch(`${API_FOLLOW(targetId)}?type=${targetType}`)
			.then((res) => res.json())
			.then((data) => setIsFollowing(data.isFollowing))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [targetId, targetType, currentUserId]);

	if (!currentUserId || currentUserId === targetId) return null;

	const handleClick = async () => {
		setLoading(true);
		try {
			if (isFollowing) {
				await fetch(`${API_FOLLOW(targetId)}?type=${targetType}`, { method: "DELETE" });
				setIsFollowing(false);
			} else {
				const body =
					targetType === "user"
						? { followingUserId: targetId }
						: { followingPageId: targetId };
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
			setLoading(false);
		}
	};

	const baseClasses = "rounded transition-colors font-medium text-sm px-3 py-1.5 border border-gray-300 hover:bg-gray-50";

	return (
		<button type="button" onClick={handleClick} disabled={loading} className={baseClasses}>
			{loading ? "..." : isFollowing ? "Unfollow" : "Follow"}
		</button>
	);
}
