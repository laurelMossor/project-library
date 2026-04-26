"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PUBLIC_PROFILE } from "@/lib/const/routes";

import { ProfileTag } from "./ProfileTag";

type ConnectionsViewProps = {
	entityId: string;
	entityType: "user" | "page";
};

type ConnectionItem = {
	id: string;
	type: "USER" | "PAGE";
	followedAt: string;
	user: {
		id: string;
		handle: string;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
		avatarImageId: string | null;
	} | null;
	page: {
		id: string;
		handle: string;
		name: string;
		avatarImageId: string | null;
	} | null;
};

type Tab = "followers" | "following";

/**
 * ConnectionsView - Shows followers and following in a tabbed view
 * Works for both user and page entities
 */
export function ConnectionsView({ entityId, entityType }: ConnectionsViewProps) {
	const [activeTab, setActiveTab] = useState<Tab>("followers");
	const [followers, setFollowers] = useState<ConnectionItem[]>([]);
	const [following, setFollowing] = useState<ConnectionItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const apiBase = entityType === "user" ? "users" : "pages";

	useEffect(() => {
		const fetchConnections = async () => {
			try {
				const [followersRes, followingRes] = await Promise.all([
					fetch(`/api/${apiBase}/${entityId}/followers`),
					fetch(`/api/${apiBase}/${entityId}/following`),
				]);

				if (followersRes.ok) {
					const data = await followersRes.json();
					setFollowers(data.followers || []);
				}

				if (followingRes.ok) {
					const data = await followingRes.json();
					setFollowing(data.following || []);
				}
			} catch (err) {
				console.error("[ConnectionsView] Error:", err);
				setError("Failed to load connections");
			} finally {
				setLoading(false);
			}
		};

		fetchConnections();
	}, [entityId, apiBase]);

	const currentList = activeTab === "followers" ? followers : following;
	const emptyMessage = activeTab === "followers"
		? "No followers yet."
		: "Not following anyone yet.";

	return (
		<div className="bg-white border rounded-lg">
			{/* Tab buttons */}
			<div className="flex border-b">
				<button
					onClick={() => setActiveTab("followers")}
					className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
						activeTab === "followers"
							? "text-rich-brown border-b-2 border-rich-brown"
							: "text-gray-500 hover:text-gray-700"
					}`}
				>
					Followers ({followers.length})
				</button>
				<button
					onClick={() => setActiveTab("following")}
					className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
						activeTab === "following"
							? "text-rich-brown border-b-2 border-rich-brown"
							: "text-gray-500 hover:text-gray-700"
					}`}
				>
					Following ({following.length})
				</button>
			</div>

			{/* Content */}
			<div className="p-6">
				{loading ? (
					<p className="text-gray-500">Loading...</p>
				) : error ? (
					<p className="text-red-500">{error}</p>
				) : currentList.length === 0 ? (
					<p className="text-gray-500">{emptyMessage}</p>
				) : (
					<div className="space-y-2">
						{currentList.map((item) => {
						const entity = item.page ?? item.user;
						if (!entity) return null;
						const href = PUBLIC_PROFILE(entity.handle);
							return (
								<ProfileTag
									key={item.id}
									entity={entity}
									actions={
										<Link href={href} className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors">
											View
										</Link>
									}
								/>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
