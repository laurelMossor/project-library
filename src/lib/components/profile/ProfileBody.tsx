"use client";

import {
	ProfileEntity,
	type ProfileStatsData,
	getProfileBio,
	getProfileInterests,
} from "@/lib/types/profile";
import { Tag } from "@/lib/components/tag/Tag";
import { ProfileStats } from "./ProfileStats";
import { ProfileElementList } from "@/lib/components/profile/ProfileElementList";

type ProfileBodyProps = {
	profile: ProfileEntity;
	stats: ProfileStatsData;
};

export function ProfileBody({ profile, stats }: ProfileBodyProps) {
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

			<ProfileStats stats={stats} />
		</div>
	);
}
