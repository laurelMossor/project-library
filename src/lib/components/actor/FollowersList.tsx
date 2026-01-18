"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Actor } from "@/lib/types/actor";
import { getActorDisplayName } from "@/lib/types/actor";
import { PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "@/lib/const/routes";

type FollowersListProps = {
	actorId: string;
	title?: string;
};

type ActorListItem = {
	type: "USER" | "ORG";
	data: {
		id: string;
		actorId: string;
		username?: string;
		slug?: string;
		name?: string;
		displayName?: string | null;
		firstName?: string | null;
		lastName?: string | null;
		avatarImageId?: string | null;
	};
};
// TODO: Clean up this component and make it more reusable

export function FollowersList({ actorId, title = "Followers" }: FollowersListProps) {
	const [followers, setFollowers] = useState<ActorListItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch(`/api/actors/${actorId}/followers`)
			.then((res) => res.json())
			.then((data) => {
				setFollowers(data.followers || []);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, [actorId]);

	if (loading) {
		return (
			<div className="bg-white border rounded-lg p-6">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-gray-500">Loading...</p>
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
						const displayName = follower.type === "USER"
							? follower.data.displayName || `${follower.data.firstName || ""} ${follower.data.lastName || ""}`.trim() || follower.data.username
							: follower.data.name;
						const href = follower.type === "USER"
							? PUBLIC_USER_PAGE(follower.data.username!)
							: PUBLIC_ORG_PAGE(follower.data.slug!);

						return (
							<Link
								key={follower.data.actorId}
								href={href}
								className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50"
							>
								{follower.data.avatarImageId ? (
									<div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
										<span className="text-sm">Avatar</span>
									</div>
								) : (
									<div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
										<span className="text-sm">{displayName?.[0]?.toUpperCase() || "?"}</span>
									</div>
								)}
								<div>
									<p className="font-medium">{displayName}</p>
									<p className="text-sm text-gray-500">{follower.type === "USER" ? "User" : "Organization"}</p>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}

export function FollowingList({ actorId, title = "Following" }: FollowersListProps) {
	const [following, setFollowing] = useState<ActorListItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch(`/api/actors/${actorId}/following`)
			.then((res) => res.json())
			.then((data) => {
				setFollowing(data.following || []);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, [actorId]);

	if (loading) {
		return (
			<div className="bg-white border rounded-lg p-6">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-gray-500">Loading...</p>
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
						const displayName = followed.type === "USER"
							? followed.data.displayName || `${followed.data.firstName || ""} ${followed.data.lastName || ""}`.trim() || followed.data.username
							: followed.data.name;
						const href = followed.type === "USER"
							? PUBLIC_USER_PAGE(followed.data.username!)
							: PUBLIC_ORG_PAGE(followed.data.slug!);

						return (
							<Link
								key={followed.data.actorId}
								href={href}
								className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50"
							>
								{followed.data.avatarImageId ? (
									<div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
										<span className="text-sm">Avatar</span>
									</div>
								) : (
									<div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
										<span className="text-sm">{displayName?.[0]?.toUpperCase() || "?"}</span>
									</div>
								)}
								<div>
									<p className="font-medium">{displayName}</p>
									<p className="text-sm text-gray-500">{followed.type === "USER" ? "User" : "Organization"}</p>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
