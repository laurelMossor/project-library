"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "@/lib/const/routes";

type ConnectionsViewProps = {
	ownerId: string;
};

type ConnectionItem = {
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

type Tab = "followers" | "following";

/**
 * ConnectionsView - Shows followers and following in a tabbed view
 */
// TODO: Refactor this monstrosity
export function ConnectionsView({ ownerId }: ConnectionsViewProps) {
	const [activeTab, setActiveTab] = useState<Tab>("followers");
	const [followers, setFollowers] = useState<ConnectionItem[]>([]);
	const [following, setFollowing] = useState<ConnectionItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchConnections = async () => {
			try {
				const [followersRes, followingRes] = await Promise.all([
					fetch(`/api/owners/${ownerId}/followers`),
					fetch(`/api/owners/${ownerId}/following`),
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
	}, [ownerId]);

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
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{currentList.map((item) => {
							const isUser = item.type === "USER" && item.user;
							const isOrg = item.type === "ORG" && item.org;
							
							const displayName = isUser
								? item.user!.displayName || `${item.user!.firstName || ""} ${item.user!.lastName || ""}`.trim() || item.user!.username
								: isOrg
								? item.org!.name
								: "Unknown";
							
							const href = isUser
								? PUBLIC_USER_PAGE(item.user!.username)
								: isOrg
								? PUBLIC_ORG_PAGE(item.org!.slug)
								: "#";

							return (
								<Link
									key={item.ownerId}
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
		</div>
	);
}
