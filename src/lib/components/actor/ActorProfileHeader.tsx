/**
 * ActorProfileHeader - Works for both User and Org actors
 * 
 * This component handles profile headers for both User and Org actors.
 * - When viewing own profile: Shows "Edit Profile" (different routes for USER vs ORG), "New Project", "New Event"
 * - When viewing other's profile: 
 *   - For USER: Shows "Send Message" and "Follow" buttons
 *   - For ORG: Shows "Follow" button
 */
"use client";

import { useState, useEffect } from "react";
import { Actor } from "@/lib/types/actor";
import { ActorProfileDisplay } from "./ActorProfileDisplay";
import { ButtonLink } from "../ui/ButtonLink";
import { Button } from "../ui/Button";
import { Session } from "next-auth";
import { PRIVATE_USER_PAGE, PRIVATE_ORG_PAGE, PROJECT_NEW, EVENT_NEW, MESSAGE_CONVERSATION } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";

type ActorProfileHeaderProps = {
	actor: Actor;
	isOwnProfile: boolean;
	session: Session | null;
	currentUserId?: string | null;
};

export function ActorProfileHeader({ actor, isOwnProfile, session, currentUserId }: ActorProfileHeaderProps) {
	const loggedIn = hasSession(session);
	const [isFollowing, setIsFollowing] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isToggling, setIsToggling] = useState(false);

	// Check if user is following this actor
	useEffect(() => {
		if (!loggedIn || isOwnProfile) {
			setIsLoading(false);
			return;
		}

		fetch(`/api/actors/${actor.data.actorId}/follow`)
			.then((res) => res.json())
			.then((data) => {
				setIsFollowing(data.isFollowing || false);
				setIsLoading(false);
			})
			.catch(() => {
				setIsLoading(false);
			});
	}, [actor.data.actorId, loggedIn, isOwnProfile]);

	const handleFollowToggle = async () => {
		if (isToggling) return;

		setIsToggling(true);
		const method = isFollowing ? "DELETE" : "POST";
		
		try {
			const res = await fetch(`/api/actors/${actor.data.actorId}/follow`, {
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
			<ActorProfileDisplay actor={actor} />

			{/* Right: Action Buttons */}
			<div className="flex flex-col gap-3">
				{isOwnProfile ? (
					<>
						{/* Edit Profile button - different routes for USER vs ORG */}
						<ButtonLink href={actor.type === "USER" ? PRIVATE_USER_PAGE : PRIVATE_ORG_PAGE} fullWidth>
							Edit Profile
						</ButtonLink>
						<ButtonLink href={PROJECT_NEW} fullWidth>
							New Project
						</ButtonLink>
						<ButtonLink href={EVENT_NEW} fullWidth>
							New Event
						</ButtonLink>
					</>
				) : (
					/* Viewing someone else's profile */
					loggedIn && !isLoading && (
						<>
							{actor.type === "USER" && (
								/* For users: show message button */
								<ButtonLink href={MESSAGE_CONVERSATION(actor.data.id)} fullWidth>
									Send Message
								</ButtonLink>
							)}
							{/* Follow button for both users and orgs */}
							<Button
								fullWidth
								variant={isFollowing ? "secondary" : "primary"}
								onClick={handleFollowToggle}
								disabled={isToggling}
							>
								{isToggling ? "..." : isFollowing ? "Unfollow" : "Follow"}
							</Button>
						</>
					)
				)}
			</div>
		</div>
	);
}

