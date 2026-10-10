"use client";

import {
	ProfileEntity,
	type FollowCounts,
	getProfileBio,
	getProfileInterests,
} from "@/lib/types/profile";
import { Tag } from "@/lib/components/tag/Tag";
import { FollowStats } from "./FollowStats";
import { PUBLIC_PROFILE } from "@/lib/const/routes";
import { ProfileElementList } from "@/lib/components/profile/ProfileElementList";

type ProfileBodyProps = {
	profile: ProfileEntity;
	followCounts: FollowCounts;
};

export function ProfileBody({ profile, followCounts }: ProfileBodyProps) {
	const connectionsHref = PUBLIC_PROFILE(profile.data.handle);

	const bio = getProfileBio(profile);
	const interests = getProfileInterests(profile);
	const elements = profile.data.elements ?? [];

	return (
		<div className="space-y-4">
			{bio && <p className="text-gray-600">{bio}</p>}

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

			<ProfileElementList elements={elements} />

			<FollowStats counts={followCounts} connectionsHref={connectionsHref} />
		</div>
	);
}
