"use client";

import { useEffect, useState } from "react";
import { PostItem } from "@/lib/types/post";
import { CollectionType } from "@/lib/types/collection";
import { getEventPosts, getPostUpdates } from "@/lib/utils/post-client";
import { formatDateTime } from "@/lib/utils/datetime";
import Link from "next/link";
import { resolveCardIdentity } from "@/lib/types/card";

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
				const data = collectionType === "event"
					? await getEventPosts(collectionId)
					: await getPostUpdates(collectionId);
				setPosts(data);
			} catch {
				setError("Failed to load posts");
			} finally {
				setLoading(false);
			}
		}
		loadPosts();
	}, [collectionId, collectionType]);

	if (loading) {
		return <div className="text-sm text-misty-forest">Loading posts...</div>;
	}

	if (error) {
		return <div className="text-sm text-novel-red">{error}</div>;
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
					// Resolve the posting identity — a page takes precedence over the author.
					const entity = post.page ?? post.user ?? null;
					const identity = entity ? resolveCardIdentity(entity) : null;

					return (
						<div key={post.id} className="border-l-2 border-soft-grey pl-4 py-2">
							{/* Attribution */}
							{identity && (
								<div className="flex items-center gap-2 mb-2">
									{/* Inline avatar for posts */}
									<Link
										href={identity.href}
										className="w-8 h-8 rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity text-xs text-warm-grey font-medium"
									>
										{identity.initials}
									</Link>
									<div className="flex items-center gap-1">
										<Link
											href={identity.href}
											className="text-xs text-rich-brown hover:underline font-medium"
										>
											{identity.name}
										</Link>
									</div>
									<span className="text-xs text-dusty-grey">
										{formatDateTime(post.createdAt)}
									</span>
								</div>
							)}
							{post.title && (
								<h4 className="font-medium text-rich-brown mb-1">{post.title}</h4>
							)}
							<p className="text-sm text-warm-grey whitespace-pre-wrap">{post.content}</p>
							{!identity && (
								<p className="text-xs text-dusty-grey mt-1">
									{formatDateTime(post.createdAt)}
								</p>
							)}
						</div>
					);
				})}
			</div>
			{maxPosts && posts.length > maxPosts && (
				<p className="text-sm text-misty-forest mt-2">
					+{posts.length - maxPosts} more {posts.length - maxPosts === 1 ? "post" : "posts"}
				</p>
			)}
		</div>
	);
}
