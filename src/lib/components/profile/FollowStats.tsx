import Link from "next/link";
import type { FollowCounts } from "@/lib/types/profile";

type FollowStatsProps = {
	counts: FollowCounts;
	connectionsHref: string;
};

/**
 * FollowStats - Displays compact follower/following counts as a link
 * Shows "Followers (X) . Following (X)" format, both link to the same connections page.
 * Counts come from the server render, so a follow (which refreshes the page) updates them.
 */
export function FollowStats({ counts, connectionsHref }: FollowStatsProps) {
	return (
		<Link
			href={connectionsHref}
			className="flex items-center gap-3 text-sm text-gray-700 hover:text-rich-brown"
		>
			<span>
				<span className="font-semibold">{counts.followers}</span>{" "}
				<span className="text-gray-500">Followers</span>
			</span>
			<span className="text-gray-300">&middot;</span>
			<span>
				<span className="font-semibold">{counts.following}</span>{" "}
				<span className="text-gray-500">Following</span>
			</span>
		</Link>
	);
}
