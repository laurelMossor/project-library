import { getUserDisplayName, PublicUser } from "@/lib/types/user";
import { UserProfileDisplay } from "./UserProfileDisplay";
import { ButtonLink } from "../ui/ButtonLink";
import { Session } from "next-auth";
import { PRIVATE_USER_PAGE, PROJECT_NEW, EVENT_NEW, MESSAGE_CONVERSATION, USER_PROFILE_SETTINGS } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { GearsIcon } from "../icons/icons";
import { TransparentCTAButton } from "../collection/CreationCTA";
import { HeadingTitle } from "../text/HeadingTitle";

type UserProfileHeaderProps = {
	user: PublicUser;
	isOwnProfile: boolean;
	session: Session | null;
};

export function UserProfileHeader({ user, isOwnProfile, session }: UserProfileHeaderProps) {
	const loggedIn = hasSession(session);
	return (
		<div className="flex flex-col md:flex-row gap-8 mb-8">
			<div className="flex flex-row items-center justify-between gap-3">
				<HeadingTitle title={getUserDisplayName(user)} />
				{isOwnProfile ? (
					// <>
					// 	<ButtonLink href={PRIVATE_USER_PAGE} fullWidth>
					// 		Edit Profile
					// 	</ButtonLink>
					// 	<ButtonLink href={PROJECT_NEW} fullWidth>
					// 		New Project
					// 	</ButtonLink>
					// 	<ButtonLink href={EVENT_NEW} fullWidth>
					// 		New Event
					// 	</ButtonLink>
					// </>
					<TransparentCTAButton href={USER_PROFILE_SETTINGS} label="Options" icon={<GearsIcon className="w-6 h-6 shrink-0" />} />
				) : (
					loggedIn && (
						<ButtonLink href={MESSAGE_CONVERSATION(user.ownerId)} fullWidth>
							Send Message
						</ButtonLink>
					)
				)}
			</div>
			<UserProfileDisplay user={user} />

			{/* Right: Action Buttons */}
		</div>
	);
}

