import { getUserDisplayName, PublicUser } from "@/lib/types/user";
import { UserProfileDisplay } from "./UserProfileDisplay";
import { ButtonLink } from "../ui/ButtonLink";
import { FollowButton } from "../ui/FollowButton";
import { Session } from "next-auth";
import { MESSAGE_CONVERSATION } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { HeadingTitle } from "../text/HeadingTitle";
import { ProfileOptionsMenu } from "./ProfileOptionsMenu";

type UserProfileHeaderProps = {
	user: PublicUser;
	isOwnProfile: boolean;
	session: Session | null;
};

export function UserProfileHeader({ user, isOwnProfile, session }: UserProfileHeaderProps) {
	const loggedIn = hasSession(session);
	return (
		<div className="flex flex-col gap-8 mb-8">
			<div className="flex items-center justify-between gap-3">
				<HeadingTitle title={getUserDisplayName(user)} />
				{isOwnProfile ? (
					<ProfileOptionsMenu />
				) : (
					loggedIn && (
						<div className="flex gap-2">
							<FollowButton targetId={user.id} targetType="user" currentUserId={session?.user?.id} />
							<ButtonLink href={MESSAGE_CONVERSATION(user.id)}>
								Send Message
							</ButtonLink>
						</div>
					)
				)}
			</div>
			<UserProfileDisplay user={user} />
		</div>
	);
}
