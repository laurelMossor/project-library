/**
 * OwnerProfileHeader - Header component for Org public profiles
 * 
 * Used on /o/[slug] pages. User profiles use UserProfileHeader instead.
 * - When viewing own org profile: Shows OrgProfileOptionsMenu
 *   - If acting as this org: full options (Edit, New Project, New Event, Settings)
 *   - If not acting as this org: "Switch to Org Profile" option
 * - When viewing another org's profile: Shows "Follow" button
 */
"use client";

import { useState, useEffect } from "react";
import { ProfileOwner, getProfileOwnerOwnerId } from "@/lib/types/profile-owner";
import { OwnerProfileDisplay } from "./OwnerProfileDisplay";
import { Button } from "../ui/Button";
import { Session } from "next-auth";
import { hasSession } from "@/lib/utils/auth-client";
import { OrgProfileOptionsMenu } from "../org/OrgProfileOptionsMenu";

type OwnerProfileHeaderProps = {
	owner: ProfileOwner;
	isOwnProfile: boolean;
	isActingAsThisOrg?: boolean;
	session: Session | null;
	currentUserId?: string | null;
};

export function OwnerProfileHeader({ owner, isOwnProfile, isActingAsThisOrg = false, session, currentUserId }: OwnerProfileHeaderProps) {
	const loggedIn = hasSession(session);
	const [isFollowing, setIsFollowing] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isToggling, setIsToggling] = useState(false);

	const ownerId = getProfileOwnerOwnerId(owner);

	// Check if user is following this owner
	useEffect(() => {
		if (!loggedIn || isOwnProfile) {
			setIsLoading(false);
			return;
		}

		fetch(`/api/owners/${ownerId}/follow`)
			.then((res) => res.json())
			.then((data) => {
				setIsFollowing(data.isFollowing || false);
				setIsLoading(false);
			})
			.catch(() => {
				setIsLoading(false);
			});
	}, [ownerId, loggedIn, isOwnProfile]);

	const handleFollowToggle = async () => {
		if (isToggling) return;

		setIsToggling(true);
		const method = isFollowing ? "DELETE" : "POST";
		
		try {
			const res = await fetch(`/api/owners/${ownerId}/follow`, {
				method,
			});

			if (res.ok) {
				setIsFollowing(!isFollowing);
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
				<OwnerProfileDisplay owner={owner} />
			</div>

			{/* Right: Action Buttons - constrained width */}
			<div className="w-full md:w-1/4 md:min-w-[200px] md:max-w-[280px] flex flex-col gap-3">
				{isOwnProfile ? (
					/* Viewing own org profile - show Options menu */
					<OrgProfileOptionsMenu isActingAsThisOrg={isActingAsThisOrg} orgOwnerId={ownerId} />
				) : (
					/* Viewing another org's profile - show Follow button */
					loggedIn && !isLoading && (
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
