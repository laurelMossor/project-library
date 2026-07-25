import { ProfileEntity, getProfileDisplayName, getProfileIdentifier, getProfileHeadline, getProfileLocation } from "@/lib/types/profile";
import { ProfilePicture } from "./ProfilePicture";
import { ClickableProfilePicture } from "./ClickableProfilePicture";

type ProfileHeaderProps = {
	profile: ProfileEntity;
	isOwnProfile?: boolean;
	/** When true, render identity only (name/handle/avatar) — no headline/location.
	 *  Used by the PRIVATE-profile locked stub so those fields don't leak. */
	identityOnly?: boolean;
};

/**
 * Shared profile header for User and Page public profiles.
 * Displays avatar (lg), display name, @handle, headline (italic), and location.
 * When isOwnProfile=true, the avatar is clickable to edit the photo.
 */
export function ProfileHeader({ profile, isOwnProfile = false, identityOnly = false }: ProfileHeaderProps) {
	const displayName = getProfileDisplayName(profile);
	const handle = getProfileIdentifier(profile);
	const headline = getProfileHeadline(profile);
	const location = getProfileLocation(profile);

	// ProfilePicture expects a CardEntity (CardUser | CardPage)
	const entity =
		profile.type === "PAGE"
			? { id: profile.data.id, name: profile.data.name, handle: profile.data.handle, avatarImageId: profile.data.avatarImageId, avatarImage: profile.data.avatarImage }
			: { id: profile.data.id, handle: profile.data.handle, displayName: profile.data.displayName, firstName: profile.data.firstName, lastName: profile.data.lastName, avatarImageId: profile.data.avatarImageId, avatarImage: profile.data.avatarImage };

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
				{!identityOnly && headline && <p className="text-lg italic text-gray-600 mt-1">{headline}</p>}
				{!identityOnly && location && <p className="text-sm text-gray-500 mt-0.5">{location}</p>}
			</div>
		</div>
	);
}
