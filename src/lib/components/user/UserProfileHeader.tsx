import { PublicUser } from "@/lib/types/user";
import { UserProfileDisplay } from "./UserProfileDisplay";
import { ButtonLink } from "../ui/ButtonLink";
import { Session } from "next-auth";
import { PRIVATE_USER_PAGE, PROJECT_NEW, EVENT_NEW, MESSAGE_CONVERSATION } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";

type UserProfileHeaderProps = {
	user: PublicUser;
	isOwnProfile: boolean;
	session: Session | null;
};

export function UserProfileHeader({ user, isOwnProfile, session }: UserProfileHeaderProps) {
	const loggedIn = hasSession(session);
	return (
		<div className="flex flex-col md:flex-row gap-8 mb-8">
			<UserProfileDisplay user={user} />

			{/* Right: Action Buttons */}
			<div className="flex flex-col gap-3">
				{isOwnProfile ? (
					<>
						<ButtonLink href={PRIVATE_USER_PAGE} fullWidth>
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
					loggedIn && (
						<ButtonLink href={MESSAGE_CONVERSATION(user.ownerId)} fullWidth>
							Send Message
						</ButtonLink>
					)
				)}
			</div>
		</div>
	);
}

