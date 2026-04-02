import { ProfileEntity, getProfileDisplayName, getProfileIdentifier } from "@/lib/types/profile";
import { ProfilePicture } from "./ProfilePicture";

type ProfileHeaderProps = {
	profile: ProfileEntity;
};

/**
 * Shared profile header for User and Page public profiles.
 * Displays avatar (lg), display name, and @handle.
 */
export function ProfileHeader({ profile }: ProfileHeaderProps) {
	const displayName = getProfileDisplayName(profile);
	const handle = getProfileIdentifier(profile);

	// ProfilePicture expects a CardEntity (CardUser | CardPage)
	// Both PublicUser and PublicPage satisfy the shape
	const entity =
		profile.type === "PAGE"
			? { id: profile.data.id, name: profile.data.name, slug: profile.data.slug, avatarImageId: profile.data.avatarImageId, avatarImage: profile.data.avatarImage }
			: { id: profile.data.id, username: profile.data.username, displayName: profile.data.displayName, firstName: profile.data.firstName, lastName: profile.data.lastName, avatarImageId: profile.data.avatarImageId, avatarImage: profile.data.avatarImage };

	return (
		<div className="flex items-center gap-4">
			<ProfilePicture entity={entity} size="lg" asLink={false} />
			<div>
				<h1 className="text-3xl font-bold">{displayName}</h1>
				<p className="text-sm text-dusty-grey mt-0.5">@{handle}</p>
			</div>
		</div>
	);
}
