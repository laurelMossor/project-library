import { PublicUser } from "@/lib/types/user";
import { ProfileDisplay } from "./ProfileDisplay";
import { ButtonLink } from "../ui/ButtonLink";
import { Session } from "next-auth";

type ProfileHeaderProps = {
	user: PublicUser;
	isOwnProfile: boolean;
	session: Session | null;
};

export function ProfileHeader({ user, isOwnProfile, session }: ProfileHeaderProps) {
	return (
		<div className="flex flex-col md:flex-row gap-8 mb-8">
			<ProfileDisplay user={user} />

			{/* Right: Action Buttons */}
			<div className="flex flex-col gap-3">
				{isOwnProfile ? (
					<>
						<ButtonLink href="/profile" fullWidth>
							Edit Profile
						</ButtonLink>
						<ButtonLink href="/projects/new" fullWidth>
							New Project
						</ButtonLink>
						<ButtonLink href="/events/new" fullWidth>
							New Event
						</ButtonLink>
					</>
				) : (
					session?.user?.id && (
						<ButtonLink href={`/messages/${user.id}`} fullWidth>
							Send Message
						</ButtonLink>
					)
				)}
			</div>
		</div>
	);
}

