"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type FollowStatsProps = {
	ownerId: string;
	connectionsHref: string;
};

/**
 * FollowStats - Displays compact follower/following counts as a link
 * Shows "Followers (X) · Following (X)" format, both link to the same connections page
 */
export function FollowStats({ ownerId, connectionsHref }: FollowStatsProps) {
	const [followerCount, setFollowerCount] = useState<number | null>(null);
	const [followingCount, setFollowingCount] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchCounts = async () => {
			try {
				// Fetch both counts in parallel
				const [followersRes, followingRes] = await Promise.all([
					fetch(`/api/owners/${ownerId}/followers`),
					fetch(`/api/owners/${ownerId}/following`),
				]);

				if (followersRes.ok) {
					const data = await followersRes.json();
					setFollowerCount(data.followers?.length ?? 0);
				}

				if (followingRes.ok) {
					const data = await followingRes.json();
					setFollowingCount(data.following?.length ?? 0);
				}
			} catch (err) {
				console.error("[FollowStats] Error fetching counts:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchCounts();
	}, [ownerId]);

	if (loading) {
		return (
			<div className="flex items-center gap-3 text-sm text-gray-500">
				<span>Loading...</span>
			</div>
		);
	}

	return (
		<Link 
			href={connectionsHref}
			className="flex items-center gap-3 text-sm text-gray-700 hover:text-rich-brown"
		>
			<span>
				<span className="font-semibold">{followerCount ?? 0}</span>{" "}
				<span className="text-gray-500">Followers</span>
			</span>
			<span className="text-gray-300">·</span>
			<span>
				<span className="font-semibold">{followingCount ?? 0}</span>{" "}
				<span className="text-gray-500">Following</span>
			</span>
		</Link>
	);
}
