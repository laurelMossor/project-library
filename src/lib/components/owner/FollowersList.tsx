"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "@/lib/const/routes";

type FollowersListProps = {
	ownerId: string;
	title?: string;
};

// Matches the API response structure from /api/owners/[ownerId]/followers
type FollowerItem = {
	ownerId: string;
	type: "USER" | "ORG";
	followedAt: string;
	user: {
		id: string;
		username: string;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
		avatarImageId: string | null;
	} | null;
	org: {
		id: string;
		slug: string;
		name: string;
		avatarImageId: string | null;
	} | null;
};

export function FollowersList({ ownerId, title = "Followers" }: FollowersListProps) {
	const [followers, setFollowers] = useState<FollowerItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchFollowers = async () => {
			try {
				const res = await fetch(`/api/owners/${ownerId}/followers`);
				
				if (!res.ok) {
					const errorText = await res.text();
					console.error(`[FollowersList] API error ${res.status}:`, errorText);
					setError(`Failed to load ${title.toLowerCase()}`);
					setLoading(false);
					return;
				}

				const data = await res.json();
				console.log("[FollowersList] API response:", data);
				
				if (!data.followers || !Array.isArray(data.followers)) {
					console.error("[FollowersList] Invalid response structure:", data);
					setError("Invalid data format");
					setLoading(false);
					return;
				}

				setFollowers(data.followers);
				setLoading(false);
			} catch (err) {
				console.error("[FollowersList] Fetch error:", err);
				setError("Failed to load followers");
				setLoading(false);
			}
		};

		fetchFollowers();
	}, [ownerId, title]);

	if (loading) {
		return (
			<div className="bg-white border rounded-lg p-6">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-gray-500">Loading...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-white border rounded-lg p-6">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-red-500">{error}</p>
			</div>
		);
	}

	return (
		<div className="bg-white border rounded-lg p-6">
			<h2 className="text-xl font-semibold mb-4">{title} ({followers.length})</h2>
			{followers.length === 0 ? (
				<p className="text-gray-500">No {title.toLowerCase()} yet.</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{followers.map((follower) => {
						const isUser = follower.type === "USER" && follower.user;
						const isOrg = follower.type === "ORG" && follower.org;
						
						const displayName = isUser
							? follower.user!.displayName || `${follower.user!.firstName || ""} ${follower.user!.lastName || ""}`.trim() || follower.user!.username
							: isOrg
							? follower.org!.name
							: "Unknown";
						
						const href = isUser
							? PUBLIC_USER_PAGE(follower.user!.username)
							: isOrg
							? PUBLIC_ORG_PAGE(follower.org!.slug)
							: "#";

						const avatarImageId = isUser ? follower.user!.avatarImageId : isOrg ? follower.org!.avatarImageId : null;

						return (
							<Link
								key={follower.ownerId}
								href={href}
								className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50"
							>
								<div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
									<span className="text-sm">{displayName?.[0]?.toUpperCase() || "?"}</span>
								</div>
								<div>
									<p className="font-medium">{displayName}</p>
									<p className="text-sm text-gray-500">{isUser ? "User" : isOrg ? "Organization" : "Unknown"}</p>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}

export function FollowingList({ ownerId, title = "Following" }: FollowersListProps) {
	const [following, setFollowing] = useState<FollowerItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchFollowing = async () => {
			try {
				const res = await fetch(`/api/owners/${ownerId}/following`);
				
				if (!res.ok) {
					const errorText = await res.text();
					console.error(`[FollowingList] API error ${res.status}:`, errorText);
					setError("Failed to load following");
					setLoading(false);
					return;
				}

				const data = await res.json();
				console.log("[FollowingList] API response:", data);
				
				if (!data.following || !Array.isArray(data.following)) {
					console.error("[FollowingList] Invalid response structure:", data);
					setError("Invalid data format");
					setLoading(false);
					return;
				}

				setFollowing(data.following);
				setLoading(false);
			} catch (err) {
				console.error("[FollowingList] Fetch error:", err);
				setError("Failed to load following");
				setLoading(false);
			}
		};

		fetchFollowing();
	}, [ownerId]);

	if (loading) {
		return (
			<div className="bg-white border rounded-lg p-6">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-gray-500">Loading...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-white border rounded-lg p-6">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-red-500">{error}</p>
			</div>
		);
	}

	return (
		<div className="bg-white border rounded-lg p-6">
			<h2 className="text-xl font-semibold mb-4">{title} ({following.length})</h2>
			{following.length === 0 ? (
				<p className="text-gray-500">Not following anyone yet.</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{following.map((followed) => {
						const isUser = followed.type === "USER" && followed.user;
						const isOrg = followed.type === "ORG" && followed.org;
						
						const displayName = isUser
							? followed.user!.displayName || `${followed.user!.firstName || ""} ${followed.user!.lastName || ""}`.trim() || followed.user!.username
							: isOrg
							? followed.org!.name
							: "Unknown";
						
						const href = isUser
							? PUBLIC_USER_PAGE(followed.user!.username)
							: isOrg
							? PUBLIC_ORG_PAGE(followed.org!.slug)
							: "#";

						return (
							<Link
								key={followed.ownerId}
								href={href}
								className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50"
							>
								<div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
									<span className="text-sm">{displayName?.[0]?.toUpperCase() || "?"}</span>
								</div>
								<div>
									<p className="font-medium">{displayName}</p>
									<p className="text-sm text-gray-500">{isUser ? "User" : isOrg ? "Organization" : "Unknown"}</p>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
