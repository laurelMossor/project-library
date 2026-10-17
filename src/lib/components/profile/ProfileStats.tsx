"use client";

import type { ProfileStatsData } from "@/lib/types/profile";
import { ProfileListPopover } from "./ProfileListPopover";

function Count({ n, label }: { n: number; label: string }) {
	return (
		<span>
			<span className="font-semibold">{n}</span> <span className="text-gray-500">{label}</span>
		</span>
	);
}

/**
 * ProfileStats — the counts under a profile: Followers · Following, plus Members on a page that has
 * any. Each count opens the list behind it. The counts are public; the member list is for members,
 * so everyone else sees that count as plain text.
 * Counts come from the server render, so a follow (which refreshes the page) updates them.
 */
export function ProfileStats({ stats }: { stats: ProfileStatsData }) {
	const { target, counts, memberCount = 0, canViewMembers = false } = stats;

	return (
		<div className="flex items-center gap-3 text-sm text-gray-700">
			<ProfileListPopover target={target} list="followers" emptyMessage="No followers yet.">
				<Count n={counts.followers} label="Followers" />
			</ProfileListPopover>
			<span className="text-gray-300">&middot;</span>
			<ProfileListPopover target={target} list="following" emptyMessage="Not following anyone yet.">
				<Count n={counts.following} label="Following" />
			</ProfileListPopover>
			{target.type === "page" && memberCount > 0 && (
				<>
					<span className="text-gray-300">&middot;</span>
					{canViewMembers ? (
						<ProfileListPopover target={target} list="members" emptyMessage="No members yet.">
							<Count n={memberCount} label={memberCount === 1 ? "Member" : "Members"} />
						</ProfileListPopover>
					) : (
						<Count n={memberCount} label={memberCount === 1 ? "Member" : "Members"} />
					)}
				</>
			)}
		</div>
	);
}
