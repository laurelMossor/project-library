"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import { EntityAvatar } from "./EntityAvatar";

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
		username: string;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
		avatarImageId: string | null;
	} | null;
	page: {
		id: string;
		slug: string;
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
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{currentList.map((item) => {
							const isUser = item.type === "USER" && item.user;
							const isPage = item.type === "PAGE" && item.page;

							const displayName = isUser
								? item.user!.displayName || `${item.user!.firstName || ""} ${item.user!.lastName || ""}`.trim() || item.user!.username
								: isPage
								? item.page!.name
								: "Unknown";

							const href = isUser
								? PUBLIC_USER_PAGE(item.user!.username)
								: isPage
								? PUBLIC_PAGE(item.page!.slug)
								: "#";

							return (
								<Link
									key={item.id}
									href={href}
									className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50"
								>
									{isUser && item.user ? (
										<EntityAvatar
											user={{
												...item.user,
												displayName: item.user.displayName ?? null,
												firstName: item.user.firstName ?? null,
												lastName: item.user.lastName ?? null,
												avatarImageId: item.user.avatarImageId ?? null,
											}}
											size="sm"
											asLink={false}
										/>
									) : isPage && item.page ? (
										<EntityAvatar
											page={{
												...item.page,
												avatarImageId: item.page.avatarImageId ?? null,
											}}
											size="sm"
											asLink={false}
										/>
									) : (
										<div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
											<span className="text-xs">?</span>
										</div>
									)}
									<div>
										<p className="font-medium">{displayName}</p>
										<p className="text-sm text-gray-500">{isUser ? "User" : isPage ? "Page" : "Unknown"}</p>
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
