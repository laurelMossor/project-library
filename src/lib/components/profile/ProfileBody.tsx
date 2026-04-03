import {
	ProfileEntity,
	getProfileHeadline,
	getProfileLocation,
	getProfileBio,
	getProfileInterests,
	getProfileEntityId,
} from "@/lib/types/profile";
import { Tag } from "@/lib/components/tag/Tag";
import { FollowStats } from "./FollowStats";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";

type ProfileBodyProps = {
	profile: ProfileEntity;
};

/**
 * Shared profile body for User and Page public profiles.
 * Renders FollowStats, shared info fields, and Page-specific fields.
 */
export function ProfileBody({ profile }: ProfileBodyProps) {
	const entityId = getProfileEntityId(profile);
	const entityType = profile.type === "PAGE" ? "page" : "user";

	const connectionsHref =
		profile.type === "PAGE"
			? PUBLIC_PAGE(profile.data.slug)
			: PUBLIC_USER_PAGE(profile.data.username);

	const headline = getProfileHeadline(profile);
	const location = getProfileLocation(profile);
	const bio = getProfileBio(profile);
	const interests = getProfileInterests(profile);

	return (
		<div className="space-y-4">
			{headline && <p className="text-lg">{headline}</p>}
			{location && <p className="text-sm text-gray-500">{location}</p>}

			{bio && (
				<div>
					<h2 className="text-sm font-medium text-gray-500">About</h2>
					<p className="mt-1">{bio}</p>
				</div>
			)}

			{interests.length > 0 && (
				<div>
					<h2 className="text-sm font-medium text-gray-500">Interests</h2>
					<div className="mt-2 flex flex-wrap gap-2">
						{interests.map((interest) => (
							<Tag key={interest} tag={interest} />
						))}
					</div>
				</div>
			)}

			<FollowStats
				entityId={entityId}
				entityType={entityType}
				connectionsHref={connectionsHref}
			/>

			{/* Page-specific fields */}
			{profile.type === "PAGE" && (
				<>
					{profile.data.tags && profile.data.tags.length > 0 && (
						<div>
							<h2 className="text-sm font-medium text-gray-500">Tags</h2>
							<div className="mt-2 flex flex-wrap gap-2">
								{profile.data.tags.map((tag) => (
									<Tag key={tag} tag={tag} />
								))}
							</div>
						</div>
					)}

					{(profile.data.addressLine1 || profile.data.city) && (
						<div>
							<h2 className="text-sm font-medium text-gray-500">Address</h2>
							<div className="mt-1 text-sm text-gray-700 space-y-0.5">
								{profile.data.addressLine1 && <p>{profile.data.addressLine1}</p>}
								{profile.data.addressLine2 && <p>{profile.data.addressLine2}</p>}
								{(profile.data.city || profile.data.state || profile.data.zip) && (
									<p>
										{[profile.data.city, profile.data.state, profile.data.zip]
											.filter(Boolean)
											.join(", ")}
									</p>
								)}
							</div>
						</div>
					)}

					{profile.data.isOpenToCollaborators && (
						<span className="inline-block text-xs px-2 py-1 rounded border border-soft-grey/60 text-dusty-grey">
							Open to collaborators
						</span>
					)}
				</>
			)}
		</div>
	);
}
