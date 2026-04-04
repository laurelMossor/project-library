import { ProfileEntity, getProfileDisplayName, getProfileIdentifier } from "@/lib/types/profile";
import { ProfilePicture } from "./ProfilePicture";
import { ClickableProfilePicture } from "./ClickableProfilePicture";

type ProfileHeaderProps = {
	profile: ProfileEntity;
	isOwnProfile?: boolean;
};

/**
 * Shared profile header for User and Page public profiles.
 * Displays avatar (lg), display name, and @handle.
 * When isOwnProfile=true, the avatar is clickable to edit the photo.
 */
export function ProfileHeader({ profile, isOwnProfile = false }: ProfileHeaderProps) {
	const displayName = getProfileDisplayName(profile);
	const handle = getProfileIdentifier(profile);

	// ProfilePicture expects a CardEntity (CardUser | CardPage)
	const entity =
		profile.type === "PAGE"
			? { id: profile.data.id, name: profile.data.name, slug: profile.data.slug, avatarImageId: profile.data.avatarImageId, avatarImage: profile.data.avatarImage }
			: { id: profile.data.id, username: profile.data.username, displayName: profile.data.displayName, firstName: profile.data.firstName, lastName: profile.data.lastName, avatarImageId: profile.data.avatarImageId, avatarImage: profile.data.avatarImage };

	return (
		<div className="flex items-center gap-4">
			{isOwnProfile ? (
				<ClickableProfilePicture entity={entity} />
			) : (
				<ProfilePicture entity={entity} size="lg" asLink={false} className="ring-4 ring-rich-brown" />
			)}
			<div>
				<h1 className="text-3xl font-bold">{displayName}</h1>
				<p className="text-sm text-dusty-grey mt-0.5">@{handle}</p>
			</div>
		</div>
	);
}
