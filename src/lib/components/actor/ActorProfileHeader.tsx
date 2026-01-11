/**
 * ActorProfileHeader - Works for both User and Org actors
 * 
 * This component handles profile headers for both User and Org actors.
 * - When viewing own profile: Shows "Edit Profile" (different routes for USER vs ORG), "New Project", "New Event"
 * - When viewing other's profile: 
 *   - For USER: Shows "Send Message" (orgs don't have messaging per schema)
 *   - For ORG: Shows "Follow" button (follow functionality to be implemented)
 */
"use client";

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

	return (
		<div className="flex flex-col md:flex-row gap-8 mb-8">
			<ActorProfileDisplay actor={actor} />

			{/* Right: Action Buttons */}
			<div className="flex flex-col gap-3">
				{isOwnProfile ? (
					<>
						{/* Edit Profile button - different routes for USER vs ORG */}
						{actor.type === "USER" ? (
							<ButtonLink href={PRIVATE_USER_PAGE} fullWidth>
								Edit Profile
							</ButtonLink>
						) : (
							<ButtonLink href={PRIVATE_ORG_PAGE} fullWidth>
								Edit Profile
							</ButtonLink>
						)}
						<ButtonLink href={PROJECT_NEW} fullWidth>
							New Project
						</ButtonLink>
						<ButtonLink href={EVENT_NEW} fullWidth>
							New Event
						</ButtonLink>
					</>
				) : (
					/* Viewing someone else's profile */
					loggedIn && (
						<>
							{actor.type === "USER" ? (
								/* For users: show message button */
								<ButtonLink href={MESSAGE_CONVERSATION(actor.data.id)} fullWidth>
									Send Message
								</ButtonLink>
							) : (
								/* For orgs: show follow button (follow functionality to be implemented) */
								<Button
									fullWidth
									variant="secondary"
									onClick={() => {
										// TODO: Implement follow/unfollow functionality
										alert("Follow functionality coming soon!");
									}}
								>
									Follow
								</Button>
							)}
						</>
					)
				)}
			</div>
		</div>
	);
}

