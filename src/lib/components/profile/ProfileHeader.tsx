/**
 * ProfileHeader - Header component for Page and User public profiles
 *
 * For PAGE profiles:
 * - When viewing own page profile: Shows PageProfileOptionsMenu
 *   - If acting as this page: full options (Edit, New Event, Settings)
 *   - If not acting as this page: "Switch to Page" option
 * - When viewing another page's profile: Shows "Follow" button
 *
 * For USER profiles:
 * - When viewing another user's profile: Shows "Follow" button
 * - When viewing own user profile: No action buttons (handled elsewhere)
 */
"use client";

import { useState, useEffect } from "react";
import { ProfileEntity, getProfileEntityId } from "@/lib/types/profile";
import { ProfileDisplay } from "./ProfileDisplay";
import { Button } from "../ui/Button";
import { Session } from "next-auth";
import { hasSession } from "@/lib/utils/auth-client";
import { PageProfileOptionsMenu } from "../page/PageProfileOptionsMenu";

type ProfileHeaderProps = {
	profile: ProfileEntity;
	isOwnProfile: boolean;
	isActingAsThisPage?: boolean;
	session: Session | null;
};

export function ProfileHeader({ profile, isOwnProfile, isActingAsThisPage = false, session }: ProfileHeaderProps) {
	const loggedIn = hasSession(session);
	const [isFollowing, setIsFollowing] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isToggling, setIsToggling] = useState(false);

	const entityId = getProfileEntityId(profile);
	const entityType = profile.type === "PAGE" ? "page" : "user";

	// Check if user is following this entity
	useEffect(() => {
		if (!loggedIn || isOwnProfile) {
			setIsLoading(false);
			return;
		}

		fetch(`/api/follows/${entityId}?type=${entityType}`)
			.then((res) => res.json())
			.then((data) => {
				setIsFollowing(data.isFollowing || false);
				setIsLoading(false);
			})
			.catch(() => {
				setIsLoading(false);
			});
	}, [entityId, entityType, loggedIn, isOwnProfile]);

	const handleFollowToggle = async () => {
		if (isToggling) return;

		setIsToggling(true);

		try {
			if (isFollowing) {
				const res = await fetch(`/api/follows/${entityId}?type=${entityType}`, { method: "DELETE" });
				if (res.ok) setIsFollowing(false);
			} else {
				const res = await fetch("/api/follows", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ followingId: entityId, followingType: entityType }),
				});
				if (res.ok) setIsFollowing(true);
			}
		} catch (error) {
			console.error("Failed to toggle follow:", error);
		} finally {
			setIsToggling(false);
		}
	};

	return (
		<div className="flex flex-col md:flex-row gap-8 mb-8">
			{/* Left: Profile Display - takes up remaining space */}
			<div className="flex-1">
				<ProfileDisplay profile={profile} />
			</div>

			{/* Right: Action Buttons - constrained width */}
			<div className="w-full md:w-1/4 md:min-w-[200px] md:max-w-[280px] flex flex-col gap-3">
				{isOwnProfile && profile.type === "PAGE" ? (
					/* Viewing own page profile - show Options menu */
					<PageProfileOptionsMenu isActingAsThisPage={isActingAsThisPage} pageId={entityId} />
				) : (
					/* Viewing another entity's profile - show Follow button */
					!isOwnProfile && loggedIn && !isLoading && (
						<Button
							fullWidth
							variant={isFollowing ? "secondary" : "primary"}
							onClick={handleFollowToggle}
							disabled={isToggling}
						>
							{isToggling ? "..." : isFollowing ? "Unfollow" : "Follow"}
						</Button>
					)
				)}
			</div>
		</div>
	);
}
