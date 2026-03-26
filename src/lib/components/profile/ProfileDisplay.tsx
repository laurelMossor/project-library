import { ProfileEntity, getProfileDisplayName, getProfileHeadline, getProfileLocation, getProfileBio, getProfileInterests } from "@/lib/types/profile";
import { Tag } from "../tag/Tag";

type ProfileDisplayProps = {
	profile: ProfileEntity;
};

export function ProfileDisplay({ profile }: ProfileDisplayProps) {
	const displayName = getProfileDisplayName(profile);
	const headline = getProfileHeadline(profile);
	const location = getProfileLocation(profile);
	const bio = getProfileBio(profile);
	const interests = getProfileInterests(profile);

	return (
		<div className="flex-1">
			<h1 className="text-3xl font-bold">{displayName}</h1>
			{headline && <p className="text-lg mt-1">{headline}</p>}
			{location && <p className="text-sm text-gray-500 mt-1">{location}</p>}
			{profile.type === "PAGE" && (
				<p className="text-sm text-gray-400 mt-1">
					{profile.data.visibility === "PUBLIC" ? "Public" : "Private"}
				</p>
			)}

			{bio && (
				<div className="mt-6">
					<h2 className="text-sm font-medium text-gray-500">About</h2>
					<p className="mt-1">{bio}</p>
				</div>
			)}

			{interests && interests.length > 0 && (
				<div className="mt-6">
					<h2 className="text-sm font-medium text-gray-500">Interests</h2>
					<div className="mt-2 flex flex-wrap gap-2">
						{interests.map((interest) => (
							<Tag key={interest} tag={interest} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}
