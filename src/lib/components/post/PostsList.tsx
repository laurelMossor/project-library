"use client";

import { useEffect, useState } from "react";
import { PostItem } from "@/lib/types/post";
import { CollectionType } from "@/lib/types/collection";
import { getPosts } from "@/lib/utils/post-client";
import { formatDateTime } from "@/lib/utils/datetime";
import Link from "next/link";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import { getUserDisplayName } from "@/lib/types/user";
import { getCardUserInitials, getCardPageInitials } from "@/lib/types/card";

type PostsListProps = {
	collectionId: string;
	collectionType: CollectionType;
	showTitle?: boolean;
	maxPosts?: number;
};

export function PostsList({
	collectionId,
	collectionType,
	showTitle = true,
	maxPosts
}: PostsListProps) {
	const [posts, setPosts] = useState<PostItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		async function loadPosts() {
			try {
				const data = await getPosts(collectionId);
				setPosts(data);
			} catch (err) {
				setError("Failed to load posts");
			} finally {
				setLoading(false);
			}
		}
		loadPosts();
	}, [collectionId, collectionType]);

	if (loading) {
		return <div className="text-sm text-gray-500">Loading posts...</div>;
	}

	if (error) {
		return <div className="text-sm text-red-500">{error}</div>;
	}

	if (posts.length === 0) {
		return null;
	}

	const displayPosts = maxPosts ? posts.slice(0, maxPosts) : posts;

	return (
		<div className="mt-6">
			{showTitle && (
				<h3 className="text-lg font-semibold mb-4">Updates</h3>
			)}
			<div className="space-y-4">
				{displayPosts.map((post) => {
					// Determine display info from user/page
					const user = post.user;
					const page = post.page;

					const displayName = page
						? page.name
						: user
						? getUserDisplayName(user)
						: null;

					const handle = page ? page.slug : user?.username;

					const profileHref = page
						? PUBLIC_PAGE(page.slug)
						: user
						? PUBLIC_USER_PAGE(user.username)
						: "#";

					const initials = page
						? getCardPageInitials(page.name)
						: user
						? getCardUserInitials(user)
						: "?";

					return (
						<div key={post.id} className="border-l-2 border-soft-grey pl-4 py-2">
							{/* Attribution */}
							{displayName && (
								<div className="flex items-center gap-2 mb-2">
									{/* Inline avatar for posts */}
									<Link
										href={profileHref}
										className="w-8 h-8 rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity text-xs text-gray-600 font-medium"
									>
										{initials}
									</Link>
									<div className="flex items-center gap-1">
										<Link
											href={profileHref}
											className="text-xs text-rich-brown hover:underline font-medium"
										>
											{displayName}
										</Link>
									</div>
									<span className="text-xs text-gray-400">
										{formatDateTime(post.createdAt)}
									</span>
								</div>
							)}
							{post.title && (
								<h4 className="font-medium text-rich-brown mb-1">{post.title}</h4>
							)}
							<p className="text-sm text-warm-grey whitespace-pre-wrap">{post.content}</p>
							{!displayName && (
								<p className="text-xs text-gray-400 mt-1">
									{formatDateTime(post.createdAt)}
								</p>
							)}
						</div>
					);
				})}
			</div>
			{maxPosts && posts.length > maxPosts && (
				<p className="text-sm text-gray-500 mt-2">
					+{posts.length - maxPosts} more {posts.length - maxPosts === 1 ? "post" : "posts"}
				</p>
			)}
		</div>
	);
}
