import { ProfileOwner, getProfileOwnerDisplayName, getProfileOwnerHeadline, getProfileOwnerLocation, getProfileOwnerBio, getProfileOwnerInterests } from "@/lib/types/profile-owner";
import { Tag } from "../tag/Tag";

type OwnerProfileDisplayProps = {
	owner: ProfileOwner;
};

export function OwnerProfileDisplay({ owner }: OwnerProfileDisplayProps) {
	const displayName = getProfileOwnerDisplayName(owner);
	const headline = getProfileOwnerHeadline(owner);
	const location = getProfileOwnerLocation(owner);
	const bio = getProfileOwnerBio(owner);
	const interests = getProfileOwnerInterests(owner);

	return (
		<div className="flex-1">
			<h1 className="text-3xl font-bold">{displayName}</h1>
			{headline && <p className="text-lg mt-1">{headline}</p>}
			{location && <p className="text-sm text-gray-500 mt-1">{location}</p>}
			{owner.type === "ORG" && (
				<p className="text-sm text-gray-400 mt-1">
					{owner.data.isPublic ? "Public" : "Private"}
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
